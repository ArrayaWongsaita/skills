import time

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
    env = {"HOME": "/Users/alice"}
    assert scrub("/Users/alice/proj, /Users/alicesense, /Users/alice-old and /Users/alice.", env)[0] == \
        "~/proj, /Users/alicesense, /Users/alice-old and ~."
    assert scrub("/x", {"HOME": "/"})[0] == "/x"


def test_scrubbed_text_scans_clean():  # Review Focus 1
    env = {"MY_TOKEN": "zq-custom-value-77"}
    raw = "\n".join([*FAKE.values(), *SHAPELESS, 'token = "abcdefgh12345"', "Bearer abcdefghijklmnop1234",
                     "zq-custom-value-77", "-----BEGIN RSA PRIVATE KEY-----\nMIIE", ""])
    text, _ = scrub(raw, env)
    assert scan(text, env) == []


ORDINARY = [
    "task-abcdefghijklmnopqrstuvwxyz1234 risk-free max_tokens = 1000, a token budget, ใช้ token น้อยลง",
    "- Token: หน่วยย่อยของข้อความที่โมเดลอ่าน",
    "Tokens: approximately 4000 per call",
    "Token: approximately",
    "trim_messages(messages, token_counter=count_tokens_approximately)",
    "num_tokens = len(encoding.encode(text))",
    "tokenizer = AutoTokenizer.from_pretrained(name)",
    '"tokenizer": "cl100k_base"',
    "secret_name: course-research-demo",
    "credentials_path: ./secrets/sa.json",
    'monkey = "bananas-forever"',
    '"key": "section-intro"',
    "--max-tokens 4000",
]


@pytest.mark.parametrize("text", ORDINARY)
def test_ordinary_text_is_untouched(text):  # Review Focus 2
    assert scrub(text, {"HOME": "/Users/alice"}) == (text, [])
    assert scan(text, {}) == []


SHAPELESS = {
    "AZURE_OPENAI_KEY=0123456789abcdef0123456789abcdef": "AZURE_OPENAI_KEY=[REDACTED:assignment]",
    "SUPABASE_KEY=sbp_0123456789abcdef": "SUPABASE_KEY=[REDACTED:assignment]",
    "key = 'abcdef0123456789'": "key = '[REDACTED:assignment]'",
    "clientSecret: correcthorsebatterystaple": "clientSecret: [REDACTED:assignment]",
    "postgresql://admin:S3cretPassw0rd@db.internal:5432/app": "postgresql://admin:[REDACTED:url-password]@db.internal:5432/app",
    "--api-key 9f8e7d6c5b4a39281706": "--api-key [REDACTED:flag]",
    "--password correcthorsebatterystaple": "--password [REDACTED:flag]",
}


@pytest.mark.parametrize("raw,expected", SHAPELESS.items())
def test_secrets_without_a_known_shape_are_redacted(raw, expected):
    assert scrub(raw, {})[0] == expected


def test_a_truncated_private_key_is_redacted_up_to_the_block_end():
    head = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\nqwerty"
    assert scrub(f"{head}\n\nafter", {})[0] == "[REDACTED:private-key]\n\nafter"
    assert scrub(f"```\n{head}\n```\nnext", {})[0] == "```\n[REDACTED:private-key]\n```\nnext"
    assert scrub(f"x {head}", {})[0] == "x [REDACTED:private-key]"


def test_long_identifier_runs_scan_quickly():
    started = time.monotonic()
    scrub("a-" * 16000, {})
    scan("a-" * 16000 + "=", {})
    assert time.monotonic() - started < 2


def test_scan_reports_each_kind_once_in_order():
    text = f"{FAKE['github-token']} {FAKE['openai-key']} {FAKE['github-token']}"
    assert scan(text, {}) == ["github-token", "openai-key"]


def test_quoted_keys_in_json_and_yaml_are_redacted():
    raw = '{"password": "hunter2hunter2", "api_key": "abcd1234efgh"}\n\'db_secret\': \'s3cr3t-value\''
    assert scrub(raw, {}) == ('{"password": "[REDACTED:assignment]", "api_key": "[REDACTED:assignment]"}\n'
                              "'db_secret': '[REDACTED:assignment]'", ["assignment"])
