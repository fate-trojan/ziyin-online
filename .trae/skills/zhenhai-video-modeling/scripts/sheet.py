import sys, glob, os
from PIL import Image, ImageDraw, ImageFont

d = sys.argv[1]
out = sys.argv[2]
start = int(sys.argv[3]) if len(sys.argv) > 3 else 0
count = int(sys.argv[4]) if len(sys.argv) > 4 else 15
cols = int(sys.argv[5]) if len(sys.argv) > 5 else 5
files = sorted(glob.glob(os.path.join(d, 't*.png')))
files = files[start:start+count]
im0 = Image.open(files[0])
W = 400
H = int(W * im0.height / im0.width)
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * H), (20, 20, 20))
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 22)
except Exception:
    font = ImageFont.load_default()
draw = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((W, H), Image.LANCZOS)
    x, y = (i % cols) * W, (i // cols) * H
    sheet.paste(im, (x, y))
    label = os.path.basename(f).replace('.png', '').replace('t', 't=')
    draw.rectangle([x, y, x + 86, y + 28], fill=(0, 0, 0))
    draw.text((x + 4, y + 2), label, fill=(255, 230, 0), font=font)
sheet.save(out, quality=88)
print(out, sheet.size, len(files))
