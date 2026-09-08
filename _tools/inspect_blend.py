import re, sys
path = r"D:/CODE/30 DAYS/DAY 4/chess_set_2k.blend/chess_set_2k.blend"
data = open(path, 'rb').read()
print('file size:', len(data))
strings = re.findall(rb'[ -~]{3,40}', data)
cands = set(s.decode('latin-1') for s in strings)
plausible = []
for c in cands:
    if re.fullmatch(r'[A-Za-z0-9_\- ]{3,30}', c) and re.search(r'[a-z]', c) and re.search(r'[A-Z0-9]', c):
        plausible.append(c)
plausible = [c for c in plausible if not re.search(r'[:;#\$%^&*()+,.<>/?\\\\]', c)]
print('plausible object/mesh names (%d):' % len(plausible))
for c in sorted(plausible):
    print('  ', repr(c))

# Look for common chess piece keywords anywhere (case-insensitive)
for kw in ['king','queen','rook','bishop','knight','pawn','board','white','black','piece','chess','set','pawn','table']:
    hits = sorted(set(c for c in cands if kw.lower() in c.lower() and len(c) < 30))
    if hits:
        print(f'keyword "{kw}":', hits)
