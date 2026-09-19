#!/usr/bin/env python3
"""Read-only candidate-pattern screen. Not an AST linter or security proof."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import re
import sys

EXCLUDED = {'.git', '.next', 'node_modules', '.venv', 'venv', 'dist', 'build', 'coverage', '__pycache__', '.gemini', '.agents'}
EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.css', '.scss'}
RULES = [
    ('typescript-any', re.compile(r'(?::\s*any\b|\bas\s+any\b|<\s*any\s*>|\bany\s*\[\s*\])')),
    ('unsafe-double-cast', re.compile(r'\bas\s+unknown\s+as\b')),
    ('typescript-ignore', re.compile(r'@ts-ignore\b')),
    ('oversized-shadow', re.compile(r'\bshadow-(?:xl|2xl)\b')),
    ('colored-shadow', re.compile(r'\bshadow-(?:indigo|violet|purple|cyan|blue|pink)-\d')),
    ('placeholder-copy', re.compile(r'lorem\s+ipsum|\bJohn Doe\b|\bCard Title\b|\bCard Description\b', re.I)),
    ('gradient-review', re.compile(r'\b(?:bg-gradient-to-|bg-linear-to-|from-(?:purple|indigo|cyan)-\d)')),
]

def scan(root: Path) -> tuple[list[dict[str, object]], int, int, list[dict[str, str]]]:
    findings: list[dict[str, object]] = []
    errors: list[dict[str, str]] = []
    scanned = 0
    skipped = 0
    def walk_error(error: OSError) -> None:
        errors.append({'file': str(error.filename or ''), 'error': 'directory-read-failed'})
    for directory, subdirs, files in os.walk(root, followlinks=False, onerror=walk_error):
        subdirs[:] = sorted(name for name in subdirs if name not in EXCLUDED and not (Path(directory) / name).is_symlink())
        for name in sorted(files):
            path = Path(directory) / name
            if path.is_symlink() or path.suffix not in EXTENSIONS:
                continue
            relative = str(path.relative_to(root))
            try:
                if path.stat().st_size > 1_000_000:
                    skipped += 1
                    continue
                text = path.read_text(encoding='utf-8')
            except (OSError, UnicodeError):
                errors.append({'file': relative, 'error': 'source-read-failed'})
                continue
            scanned += 1
            for number, line in enumerate(text.splitlines(), 1):
                for rule, pattern in RULES:
                    if pattern.search(line):
                        findings.append({'file': relative, 'line': number, 'rule': rule, 'status': 'needs-review'})
    return findings, scanned, skipped, errors

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project', type=Path)
    args = parser.parse_args()
    if not args.project.is_dir():
        print('Project path must be a directory.', file=sys.stderr)
        return 2
    findings, scanned, skipped, errors = scan(args.project.resolve())
    print(json.dumps({'tool': 'heuristic-read-only-screen', 'scanned_files': scanned,
                      'skipped_large_files': skipped, 'findings': findings, 'errors': errors,
                      'limitations': 'Line-based patterns may match comments or miss multiline/aliased code. No secrets/content are printed. RLS, authorization, accessibility, and runtime behavior are not verified.'}, indent=2))
    return 2 if errors else (1 if findings else 0)

if __name__ == '__main__':
    raise SystemExit(main())
