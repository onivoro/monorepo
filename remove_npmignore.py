#!/usr/bin/env python3
import os
import glob

# Find all .npmignore files in the libs directory
npmignore_files = glob.glob('/Users/leenorris/github.com/onivoro/monorepo/libs/**/.npmignore', recursive=True)

# Remove each file
for file_path in npmignore_files:
    try:
        os.remove(file_path)
        print(f"Removed: {file_path}")
    except OSError as e:
        print(f"Error removing {file_path}: {e}")

print(f"Total files removed: {len(npmignore_files)}")