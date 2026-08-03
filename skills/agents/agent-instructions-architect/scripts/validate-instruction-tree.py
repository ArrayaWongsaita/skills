#!/usr/bin/env python3
"""Validate repository instruction references and runtime load semantics."""

from instruction_model import run_cli


if __name__ == "__main__":
    raise SystemExit(run_cli("validate"))
