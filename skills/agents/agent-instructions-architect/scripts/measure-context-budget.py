#!/usr/bin/env python3
"""Measure resolved repository instruction context by runtime."""

from instruction_model import run_cli


if __name__ == "__main__":
    raise SystemExit(run_cli("measure"))
