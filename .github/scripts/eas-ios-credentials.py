#!/usr/bin/env python3
"""Run `eas credentials:configure-build` for iOS in a pseudo-terminal.

EAS only creates a distribution certificate interactively, and configure-build has no
--non-interactive flag. This answers the few prompts we expect with their default (yes) and
stops on anything else, so it never agrees to something we didn't plan for.
"""
import os
import pty
import re
import select
import sys
import time

# Prompts that are safe to accept with Enter (their default is yes: reuse, or make this app's own profile).
SAFE = [
    "Reuse this distribution certificate?",
    "Would you like to reuse the original profile?",
    "Reuse this App Store Connect API Key?",
    "Generate a new Apple Provisioning Profile?",
]
ANSI = re.compile(rb"\x1b\[[0-9;?]*[A-Za-z]")
CMD = ["eas", "credentials:configure-build", "--platform", "ios", "--profile", "production"]

pid, fd = pty.fork()
if pid == 0:
    os.execvp(CMD[0], CMD)

buf = b""
answered = 0
deadline = time.time() + 900
while time.time() < deadline:
    r, _, _ = select.select([fd], [], [], 1)
    if not r:
        continue
    try:
        chunk = os.read(fd, 4096)
    except OSError:
        break
    if not chunk:
        break
    sys.stdout.buffer.write(chunk)
    sys.stdout.flush()
    buf = (buf + ANSI.sub(b"", chunk))[-4000:]
    text = buf.decode("utf-8", "replace")
    # Look only at the newest open prompt: it starts with "? " and ends with the "›" marker.
    starts = [m.end() for m in re.finditer(r"(?:^|[\r\n])\? ", text)]
    prompt = text[starts[-1]:] if starts else ""
    if "›" in prompt:
        if any(p in prompt for p in SAFE):
            os.write(fd, b"\r")
            answered += 1
            buf = b""
        else:
            print("\n::error::EAS asked something this script doesn't answer. See the prompt above.", flush=True)
            os.kill(pid, 9)
            sys.exit(1)
else:
    print("\n::error::Timed out after 15 minutes.", flush=True)
    os.kill(pid, 9)
    sys.exit(1)

_, status = os.waitpid(pid, 0)
code = os.waitstatus_to_exitcode(status)
print(f"\nconfigure-build exited with {code} after {answered} answered prompt(s).", flush=True)
sys.exit(code)
