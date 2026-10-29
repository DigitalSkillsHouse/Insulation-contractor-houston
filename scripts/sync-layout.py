#!/usr/bin/env python3
"""Keep the header, footer and sticky call button identical on every page.

Edit the shared pieces in scripts/layout/ (header.html, footer.html,
sticky-call.html), then run:   python scripts/sync-layout.py
Use --check to only report pages that have drifted (exit code 1 if any).
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAYOUT = os.path.join(ROOT, 'scripts', 'layout')

PARTS = {
    'header': (re.compile(r'<div id="navbar-container">.*?</header>\s*</div>', re.S), 'header.html'),
    'footer': (re.compile(r'<div id="footer-container">.*?</footer>\s*</div>', re.S), 'footer.html'),
    'sticky': (re.compile(r'<div id="sticky-call-button-container">.*?</a>\s*</div>', re.S), 'sticky-call.html'),
}


def load(name):
    with open(os.path.join(LAYOUT, name), encoding='utf8', newline='') as f:
        return f.read().replace('\r\n', '\n').strip('\n')


def main():
    check = '--check' in sys.argv
    comps = {k: load(v[1]) for k, v in PARTS.items()}
    pages = sorted(glob.glob(os.path.join(ROOT, '*.html')) + glob.glob(os.path.join(ROOT, 'blog', '*.html')))
    drift = 0
    for path in pages:
        rel = os.path.relpath(path, ROOT).replace(os.sep, '/')
        with open(path, encoding='utf8', newline='') as f:
            raw = f.read()
        crlf = '\r\n' in raw
        text = raw.replace('\r\n', '\n')
        new = text
        missing = []
        for key, (rx, _) in PARTS.items():
            if not rx.search(new):
                missing.append(key)
                continue
            new = rx.sub(lambda m, k=key: comps[k], new, count=1)
        if missing == ['sticky']:
            anchor = '<script src="assets/js/supabase-client.js"></script>'
            if anchor in new:
                new = new.replace(anchor, comps['sticky'] + '\n  ' + anchor, 1)
                missing = []
        if missing:
            print('SKIP %-52s no %s block' % (rel, '/'.join(missing)))
        if new != text:
            drift += 1
            if check:
                print('DRIFT %s' % rel)
            else:
                if crlf:
                    new = new.replace('\n', '\r\n')
                with open(path, 'w', encoding='utf8', newline='') as f:
                    f.write(new)
                print('updated %s' % rel)
    print('%s: %d page(s) %s' % ('check' if check else 'sync', drift, 'differ from the shared layout' if check else 'changed'))
    return 1 if (check and drift) else 0


if __name__ == '__main__':
    sys.exit(main())
