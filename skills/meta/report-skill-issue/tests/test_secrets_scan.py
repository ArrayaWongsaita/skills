import pytest

from secrets_scan import scan, scrub

FAKE = {
    "anthropic-key": "sk-ant-api03-" + "a" * 40,
    "openai-key": "sk-proj-" + "b" * 40,
    "github-token": "ghp_" + "c" * 36,
    "aws-access-key-id": "AKIA" + "ABCDEFGHIJKLMNOP",
    "google-api-key": "AIza" + "d" * 35,
    "slack-token": "xoxb-1234567890-abcdefghij",
    "jwt": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
}


@pytest.mark.parametrize("kind,value", FAKE.items())
def test_each_token_shape_is_redacted(kind, value):
    assert scrub(f"got {value} in the log", {}) == (f"got [REDACTED:{kind}] in the log", [kind])


def test_private_key_block_is_redacted():
    block = "-----BEGIN OPENSSH PRIVATE KEY-----\nabc\ndef\n-----END OPENSSH PRIVATE KEY-----"
    assert scrub(f"key:\n{block}\nend", {}) == ("key:\n[REDACTED:private-key]\nend", ["private-key"])


def test_bearer_and_assignments_keep_their_names():
    raw = ('Authorization: Bearer abcdefghijklmnop1234\napi_key = "q1w2e3r4t5y6"\npassword: hunter2hunter2\n'
           "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY")
    text, kinds = scrub(raw, {})
    assert text == ('Authorization: Bearer [REDACTED:bearer-token]\napi_key = "[REDACTED:assignment]"\n'
                    "password: [REDACTED:assignment]\nAWS_SECRET_ACCESS_KEY=[REDACTED:assignment]")
    assert kinds == ["bearer-token", "assignment"]


def test_reporters_own_secret_values_are_redacted():
    env = {"MY_SERVICE_TOKEN": "zq-custom-value-77", "SHORT_KEY": "abc", "PATH": "/usr/bin:/bin"}
    assert scrub("value zq-custom-value-77 and abc in /usr/bin", env) == (
        "value [REDACTED:env:MY_SERVICE_TOKEN] and abc in /usr/bin", ["env:MY_SERVICE_TOKEN"])


def test_home_path_becomes_tilde_only_on_a_boundary():  # Review Focus 3
    env = {"HOME": "/Users/non"}
    assert scrub("/Users/non/proj, /Users/nonsense, /Users/non-old and /Users/non.", env)[0] == \
        "~/proj, /Users/nonsense, /Users/non-old and ~."
    assert scrub("/x", {"HOME": "/"})[0] == "/x"


def test_scrubbed_text_scans_clean():  # Review Focus 1
    env = {"MY_TOKEN": "zq-custom-value-77"}
    raw = "\n".join([*FAKE.values(), 'token = "abcdefgh12345"', "Bearer abcdefghijklmnop1234", "zq-custom-value-77"])
    text, _ = scrub(raw, env)
    assert scan(text, env) == []


def test_ordinary_text_is_untouched():  # Review Focus 2
    text = "task-abcdefghijklmnopqrstuvwxyz1234 risk-free max_tokens = 1000, a token budget, ใช้ token น้อยลง"
    assert scrub(text, {"HOME": "/Users/non"}) == (text, [])
    assert scan(text, {}) == []


def test_scan_reports_each_kind_once_in_order():
    text = f"{FAKE['github-token']} {FAKE['openai-key']} {FAKE['github-token']}"
    assert scan(text, {}) == ["github-token", "openai-key"]


def test_quoted_keys_in_json_and_yaml_are_redacted():
    raw = '{"password": "hunter2hunter2", "api_key": "abcd1234efgh"}\n\'db_secret\': \'s3cr3t-value\''
    assert scrub(raw, {}) == ('{"password": "[REDACTED:assignment]", "api_key": "[REDACTED:assignment]"}\n'
                              "'db_secret': '[REDACTED:assignment]'", ["assignment"])
