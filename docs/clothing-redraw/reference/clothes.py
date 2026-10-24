import math, os, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

INK = '#1e140e'


def rgb(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    A, B = rgb(a), rgb(b)
    return '#%02x%02x%02x' % tuple(round(A[i] + (B[i] - A[i]) * t) for i in range(3))


def ol(c):
    return mix(c, INK, 0.75)


def shade(c, k=0.2):
    return mix(c, '#000000', k)


def light(c, k=0.3):
    return mix(c, '#ffffff', k)


def f(v):
    return f'{v:.1f}'


def pt(p):
    return f'{f(p[0])} {f(p[1])}'


OW = 2.2
_id = [0]


def uid(prefix):
    _id[0] += 1
    return f'{prefix}{_id[0]}'


def shape(d, fill, details='', outline=None, width=None, opacity=1):
    """Fill, clipped details, outline on top (same recipe as paintShape)."""
    width = OW if width is None else width
    edge = outline or ol(fill)
    out = ''
    if details:
        cid = uid('c')
        out += f'<clipPath id="{cid}"><path d="{d}"/></clipPath>'
    op = f' opacity="{opacity}"' if opacity != 1 else ''
    out += f'<g{op}><path d="{d}" fill="{fill}"/>'
    if details:
        out += f'<g clip-path="url(#{cid})">{details}</g>'
    out += f'<path d="{d}" fill="none" stroke="{edge}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"/></g>'
    return out


def stroke(d, color, width, opacity=1, dash=None, cap='round'):
    da = f' stroke-dasharray="{dash}"' if dash else ''
    op = f' opacity="{opacity}"' if opacity != 1 else ''
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="{cap}" stroke-linejoin="round"{da}{op}/>'


def outlined(d, color, width):
    return stroke(d, ol(color), width + OW) + stroke(d, color, width)


def ellipse(cx, cy, rx, ry, fill, rot=0, outline=True, opacity=1):
    tr = f' transform="rotate({rot} {f(cx)} {f(cy)})"' if rot else ''
    s = f' stroke="{ol(fill)}" stroke-width="{OW}"' if outline else ''
    op = f' opacity="{opacity}"' if opacity != 1 else ''
    return f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="{fill}"{s}{tr}{op}/>'


def circle(cx, cy, r, fill, outline=True, opacity=1):
    s = f' stroke="{ol(fill)}" stroke-width="{OW}"' if outline else ''
    op = f' opacity="{opacity}"' if opacity != 1 else ''
    return f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{fill}"{s}{op}/>'


def svg(vb, body):
    x, y, w, h = vb
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{f(x)} {f(y)} {f(w)} {f(h)}" width="{f(w * 3)}" height="{f(h * 3)}">{body}</svg>'


def save(name, vb, body):
    with open(os.path.join(OUT, name), 'w') as fh:
        fh.write(svg(vb, body))


# ---------------------------------------------------------------- pet

FUR = '#9A5530'
FUR_LIGHT = '#C9814E'
EAR = '#6E3A1E'


class Pet:
    def __init__(s, cx, cy, L, ry, leg, hr):
        s.cx, s.cy, s.L, s.ry, s.legLen, s.hr = cx, cy, L, ry, leg, hr
        s.hx = cx + L - 4
        s.hy = cy - ry - hr * 0.3
        s.ground = cy + ry * 0.4 + leg
        s.w = hr * 0.42
        s.nf = cx + L * 0.6   # near fore
        s.ff = cx + L * 0.78  # far fore
        s.nr = cx - L * 0.7   # near hind
        s.fr = cx - L * 0.52  # far hind
        s.legTop = cy + ry * 0.1

    def top(s, u, o=0):
        return (s.cx + u * (s.L + o), s.cy - (s.ry + o) * math.sqrt(max(0.0, 1 - u * u)))

    def bot(s, u, o=0):
        return (s.cx + u * (s.L + o), s.cy + (s.ry + o) * math.sqrt(max(0.0, 1 - u * u)))

    def arc(s, p, o=0, large=0):
        return f'A {f(s.L + o)} {f(s.ry + o)} 0 {large} 1 {pt(p)}'

    def leg_d(s, x):
        w = s.w
        return f'M{f(x - w / 2)} {f(s.legTop)} L{f(x + w / 2)} {f(s.legTop)} L{f(x + w / 2)} {f(s.ground - 4)} Q{f(x + w / 2)} {f(s.ground)} {f(x)} {f(s.ground)} Q{f(x - w / 2)} {f(s.ground)} {f(x - w / 2)} {f(s.ground - 4)} Z'

    def leg(s, x, far):
        col = shade(FUR, 0.28) if far else FUR
        return shape(s.leg_d(x), col) + ellipse(x + 2.5, s.ground - 2.5, s.w * 0.72, 3.6, light(col, 0.15))

    def tail(s):
        a = (s.cx - s.L + 6, s.cy - s.ry * 0.4)
        c1 = (s.cx - s.L - 16, s.cy - s.ry * 1.3)
        b = (s.cx - s.L - 10, s.cy - s.ry * 2.3)
        d = f'M{pt(a)} Q{pt(c1)} {pt(b)}'
        return stroke(d, ol(FUR), 7.5) + stroke(d, FUR, 4.4)

    def body(s):
        return ellipse(s.cx, s.cy, s.L, s.ry, FUR) + ellipse(s.cx + s.L * 0.12, s.cy + s.ry * 0.5, s.L * 0.6, s.ry * 0.34, FUR_LIGHT, outline=False, opacity=0.8)

    def head(s):
        hx, hy, r = s.hx, s.hy, s.hr
        o = ''
        o += circle(hx, hy, r, FUR)
        o += ellipse(hx + r * 0.55, hy + r * 0.35, r * 0.55, r * 0.4, FUR_LIGHT)
        o += ellipse(hx + r * 1.02, hy + r * 0.2, r * 0.17, r * 0.13, INK, outline=False)
        o += ellipse(hx - r * 0.1, hy - r * 0.5, r * 0.22, r * 0.14, light(FUR, 0.25), rot=-20, outline=False, opacity=0.8)
        for (ex, ey, er) in ((hx + r * 0.08, hy - r * 0.06, r * 0.25), (hx + r * 0.62, hy - r * 0.12, r * 0.21)):
            o += circle(ex, ey, er, INK, outline=False)
            o += circle(ex + er * 0.3, ey - er * 0.32, er * 0.36, '#ffffff', outline=False)
            o += circle(ex - er * 0.3, ey + er * 0.3, er * 0.14, '#ffffff', outline=False)
        o += ellipse(hx + r * 0.25, hy + r * 0.45, r * 0.18, r * 0.1, '#ff9ab0', outline=False, opacity=0.55)
        ear = (f'M{pt((hx - r * 0.25, hy - r * 0.85))} C{pt((hx - r * 1.05, hy - r * 0.7))} {pt((hx - r * 1.0, hy + r * 0.55))} {pt((hx - r * 0.55, hy + r * 0.75))} '
               f'C{pt((hx - r * 0.2, hy + r * 0.55))} {pt((hx - r * 0.02, hy - r * 0.35))} {pt((hx - r * 0.25, hy - r * 0.85))} Z')
        o += shape(ear, EAR)
        return o

    def render(s, g=None):
        g = g or {}
        o = s.tail()
        o += s.leg(s.fr, True) + s.leg(s.ff, True)
        o += g.get('far', '')
        o += s.body()
        o += s.leg(s.nr, False) + s.leg(s.nf, False)
        o += g.get('body', '')
        o += g.get('near', '')
        o += g.get('hood', '')
        o += s.head()
        o += g.get('neck', '')
        o += g.get('hat', '')
        return o


STD = Pet(cx=104, cy=96, L=56, ry=24, leg=30, hr=30)
LONG = Pet(cx=150, cy=96, L=92, ry=22, leg=18, hr=28)


def pet_vb(p):
    x0 = p.cx - p.L - 30
    x1 = p.hx + p.hr * 1.35
    y0 = p.hy - p.hr - 8
    y1 = p.ground + 6
    return (x0, y0, x1 - x0, y1 - y0)


# ---------------------------------------------------------------- jackets


def rib(d, color, width):
    return stroke(d, color, width) + stroke(d, shade(color, 0.18), width, dash='1.2 2.4', cap='butt')


def sleeve(p, x, color, cuff, far, length=0.62):
    col = shade(color, 0.28) if far else color
    cuffc = shade(cuff, 0.28) if far else cuff
    w = p.w + 2.6
    y0 = p.cy + p.ry * 0.35
    y1 = p.legTop + (p.ground - p.legTop) * length
    d = f'M{f(x - w / 2 - 1.5)} {f(y0)} Q{f(x)} {f(y0 - 4)} {f(x + w / 2 + 1.5)} {f(y0)} L{f(x + w / 2)} {f(y1)} L{f(x - w / 2)} {f(y1)} Z'
    cd = f'M{f(x - w / 2 - 0.6)} {f(y1 - 5)} L{f(x + w / 2 + 0.6)} {f(y1 - 5)} L{f(x + w / 2 + 0.6)} {f(y1)} Q{f(x)} {f(y1 + 1.5)} {f(x - w / 2 - 0.6)} {f(y1)} Z'
    ribs = stroke(f'M{f(x - w / 2)} {f(y1 - 2.5)} L{f(x + w / 2)} {f(y1 - 2.5)}', shade(cuffc, 0.2), 5, dash='1.1 2', cap='butt')
    return shape(d, col) + shape(cd, cuffc, ribs)


def neck_roll(p, color, width, ribbed=True):
    a = p.top(0.5, 2)
    c1 = (p.cx + p.L * 0.92, p.cy - p.ry - 7)
    b = (p.cx + p.L + 1, p.cy - p.ry * 0.45)
    d = f'M{pt(a)} Q{pt(c1)} {pt(b)}'
    o = stroke(d, ol(color), width + OW) + stroke(d, color, width)
    if ribbed:
        o += stroke(d, shade(color, 0.16), width, dash='1.3 2.3', cap='butt')
    return o


def sweater(p, c, d_, short=True):
    o = 2.5
    ur = -0.70 if short else -0.82
    P0, P1, B1 = p.top(ur, o), p.top(0.93, o), p.bot(0.82, o)
    xr = P0[0]
    H1 = (p.cx - p.L * 0.15, p.cy + p.ry * 0.72)
    hem = (f'Q{f(p.cx + p.L * 0.35)} {f(p.cy + p.ry + o)} {pt(H1)} '
           f'Q{f(p.cx - p.L * 0.5)} {f(p.cy + p.ry * 0.6)} {f(xr + 1)} {f(p.cy + p.ry * 0.3)} '
           f'Q{f(xr - 3)} {f(p.cy - p.ry * 0.2)} {pt(P0)}')
    d = f'M{pt(P0)} {p.arc(P1, o)} {p.arc(B1, o)} {hem} Z'
    det = ''
    # cable-knit columns: spacing is fixed, so a long body gets more columns, not wider ones
    x = xr + 12
    while x < P1[0] - 6:
        for sgn in (1, -1):
            y = p.cy - p.ry - 6
            path = f'M{f(x)} {f(y)}'
            k = sgn
            while y < p.cy + p.ry + 4:
                path += f' Q{f(x + 3.4 * k)} {f(y + 3.5)} {f(x)} {f(y + 7)}'
                y += 7
                k = -k
            det += stroke(path, shade(c, 0.2), 1.4)
        x += 15
    det += stroke(f'M{pt(B1)} {hem}', d_, 8) + stroke(f'M{pt(B1)} {hem}', shade(d_, 0.16), 8, dash='1.2 2.4', cap='butt')
    det += stroke(f'M{pt(p.top(-0.5, -4))} Q{pt((p.cx, p.cy - p.ry - 3))} {pt(p.top(0.6, -4))}', light(c, 0.35), 2.2, opacity=0.7)
    body = shape(d, c, det) + neck_roll(p, d_, 9.5)
    return {
        'body': body,
        'near': sleeve(p, p.nf, c, d_, False),
        'far': sleeve(p, p.ff, c, d_, True),
    }


def puffer(p, c, d_, rainbow=False):
    o = 3
    ur, uf, ub = -0.86, 0.92, 0.84
    xs = p.cx + ur * (p.L + o)
    n = max(3, round((uf - ur) * p.L / 22))
    ut = [ur + (uf - ur) * i / n for i in range(n + 1)]
    ubt = [ur + (ub - ur) * i / n for i in range(n + 1)]
    path = f'M{pt(p.top(ut[0], o))}'
    for i in range(n):
        um = (ut[i] + ut[i + 1]) / 2
        path += f' Q{pt(p.top(um, o + 7))} {pt(p.top(ut[i + 1], o))}'
    path += f' {p.arc(p.bot(ubt[-1], o), o)}'
    for i in range(n, 0, -1):
        um = (ubt[i] + ubt[i - 1]) / 2
        path += f' Q{pt(p.bot(um, o + 6))} {pt(p.bot(ubt[i - 1], o))}'
    path += f' Q{f(xs - 5)} {f(p.cy)} {pt(p.top(ut[0], o))} Z'
    cols = ['#FF8CC4', '#FFB15C', '#FFE16B', '#8FE3A8', '#7EC8F5', '#B9A2F5']
    det = ''
    for i in range(n):
        x0 = p.top(ut[i], o)[0] if i else xs - 20
        x1 = p.top(ut[i + 1], o)[0] if i < n - 1 else p.cx + p.L + 30
        col = cols[i % len(cols)] if rainbow else c
        if rainbow:
            det += f'<rect x="{f(x0)}" y="{f(p.cy - 60)}" width="{f(x1 - x0 + 0.5)}" height="120" fill="{col}"/>'
        um = (ut[i] + ut[i + 1]) / 2
        tx, ty = p.top(um, o + 1)
        det += stroke(f'M{f(tx - 6)} {f(ty + 5)} Q{f(tx)} {f(ty + 1)} {f(tx + 6)} {f(ty + 5)}', light(col, 0.5), 2.6, opacity=0.9)
        det += stroke(f'M{f(tx - 5)} {f(p.cy + p.ry * 0.55)} Q{f(tx)} {f(p.cy + p.ry * 0.75)} {f(tx + 5)} {f(p.cy + p.ry * 0.55)}', shade(col, 0.18), 2, opacity=0.6)
    for i in range(1, n):
        a, b = p.top(ut[i], o), p.bot(ubt[i], o)
        seam = rainbow and cols[i % len(cols)] or c
        det += stroke(f'M{pt(a)} Q{f((a[0] + b[0]) / 2 - 3)} {f(p.cy)} {pt(b)}', shade(seam, 0.28), 1.8)
    body = shape(path, c if not rainbow else cols[0], det)
    collar = d_ or light(c, 0.5)
    body += neck_roll(p, collar, 12, ribbed=False)
    a = p.top(0.52, 2)
    body += stroke(f'M{f(a[0] + 4)} {f(a[1] - 4)} Q{f(p.cx + p.L * 0.88)} {f(p.cy - p.ry - 8)} {f(p.cx + p.L - 1)} {f(p.cy - p.ry * 0.7)}', light(collar, 0.5), 2.4, opacity=0.9)
    return {'body': body}


def vest(p, c):
    o = 2.5
    ur = -0.18
    P0, P1, B1, B0 = p.top(ur, o), p.top(0.93, o), p.bot(0.72, o), p.bot(ur, o)
    d = f'M{pt(P0)} {p.arc(P1, o)} {p.arc(B1, o)} {p.arc(B0, o)} Q{f(B0[0] - 4)} {f(p.cy)} {pt(P0)} Z'
    det = ''
    x0, x1 = P0[0] - 40, P1[0] + 40
    k = x0
    while k < x1:
        det += stroke(f'M{f(k)} {f(p.cy - 40)} L{f(k + 80)} {f(p.cy + 40)}', shade(c, 0.28), 1.2, opacity=0.8)
        det += stroke(f'M{f(k)} {f(p.cy + 40)} L{f(k + 80)} {f(p.cy - 40)}', shade(c, 0.28), 1.2, opacity=0.8)
        k += 10
    det += stroke(f'M{pt(B1)} {p.arc(B0, o)} Q{f(B0[0] - 4)} {f(p.cy)} {pt(P0)}', shade(c, 0.2), 5)
    det += stroke(f'M{pt(p.top(-0.05, -4))} Q{pt((p.cx + p.L * 0.4, p.cy - p.ry - 2))} {pt(p.top(0.7, -4))}', light(c, 0.4), 2.2, opacity=0.7)
    zx = p.cx + p.L * 0.84
    det += stroke(f'M{f(zx)} {f(p.cy - p.ry * 0.5)} L{f(zx - 2)} {f(p.cy + p.ry * 0.9)}', '#e0b43c', 2)
    body = shape(d, c, det)
    body += neck_roll(p, shade(c, 0.12), 7, ribbed=False)
    body += shape(f'M{f(zx - 2.2)} {f(p.cy - p.ry * 0.5)} L{f(zx + 2.2)} {f(p.cy - p.ry * 0.5)} L{f(zx + 1.6)} {f(p.cy - p.ry * 0.5 + 7)} L{f(zx - 1.6)} {f(p.cy - p.ry * 0.5 + 7)} Z', '#e0b43c')
    # armhole binding over the near fore leg
    x = p.nf
    near = stroke(f'M{f(x - p.w / 2 - 3)} {f(p.legTop + 1)} Q{f(x)} {f(p.legTop + p.ry * 0.5)} {f(x + p.w / 2 + 3)} {f(p.legTop + 1)}', ol(c), 4.4) + \
        stroke(f'M{f(x - p.w / 2 - 3)} {f(p.legTop + 1)} Q{f(x)} {f(p.legTop + p.ry * 0.5)} {f(x + p.w / 2 + 3)} {f(p.legTop + 1)}', shade(c, 0.2), 2.6)
    return {'body': body}


def raincoat(p, c):
    o = 3
    xr = p.cx - p.L - 6
    yr = p.cy - p.ry * 0.1
    P0 = (xr, yr)
    T0 = p.top(-0.82, o)
    T1 = p.top(0.84, o)
    F = (p.cx + p.L * 0.97, p.cy + p.ry * 0.35)
    hem = (f'Q{f(p.cx + p.L * 0.3)} {f(p.cy + p.ry * 0.5)} {f(p.cx - p.L * 0.3)} {f(p.cy + p.ry * 0.58)} '
           f'Q{f(xr - 4)} {f(p.cy + p.ry * 0.66)} {f(xr - 6)} {f(p.cy + p.ry * 0.4)}')
    d = (f'M{pt(P0)} Q{f(xr - 1)} {f(T0[1] - 2)} {pt(T0)} {p.arc(T1, o)} '
         f'Q{f(p.cx + p.L + 8)} {f(p.cy - p.ry * 0.25)} {pt(F)} {hem} Q{f(xr - 6)} {f(yr + 2)} {pt(P0)} Z')
    det = stroke(f'M{pt(F)} {hem}', shade(c, 0.25), 4.5)
    strip = (f'M{f(F[0] + 2)} {f(F[1] - 7)} Q{f(p.cx + p.L * 0.3)} {f(p.cy + p.ry * 0.5 - 8)} {f(p.cx - p.L * 0.3)} {f(p.cy + p.ry * 0.58 - 8)} '
             f'Q{f(xr - 4)} {f(p.cy + p.ry * 0.66 - 8)} {f(xr - 8)} {f(p.cy + p.ry * 0.4 - 8)}')
    det += stroke(strip, shade(c, 0.35), 4.6) + stroke(strip, '#E9ECF2', 3.2) + stroke(strip, '#ffffff', 1, opacity=0.8)
    det += stroke(f'M{pt(p.top(-0.62, -5))} Q{pt((p.cx - p.L * 0.1, p.cy - p.ry - 1))} {pt(p.top(0.35, -6))}', '#ffffff', 3, opacity=0.55)
    body = shape(d, c, det)
    for (tx, ty) in ((p.cx + p.L * 0.86, p.cy - p.ry * 0.3), (p.cx + p.L * 0.9, p.cy + p.ry * 0.02)):
        body += stroke(f'M{f(tx - 6)} {f(ty)} L{f(tx + 3)} {f(ty)}', shade(c, 0.45), 1.2)
        body += f'<rect x="{f(tx - 1)}" y="{f(ty - 1.6)}" width="7" height="3.2" rx="1.6" fill="#7A4A22" stroke="{ol("#7A4A22")}" stroke-width="1.4" transform="rotate(-20 {f(tx + 2.5)} {f(ty)})"/>'
    hx, hy, r = p.hx, p.hy, p.hr
    hcx, hcy = hx - r * 0.98, hy + r * 0.5
    hood = (f'M{f(hcx - r * 0.6)} {f(hcy + r * 0.3)} Q{f(hcx - r * 0.75)} {f(hcy - r * 0.6)} {f(hcx + r * 0.05)} {f(hcy - r * 0.55)} '
            f'Q{f(hcx + r * 0.7)} {f(hcy - r * 0.5)} {f(hcx + r * 0.62)} {f(hcy + r * 0.25)} Q{f(hcx)} {f(hcy + r * 0.5)} {f(hcx - r * 0.6)} {f(hcy + r * 0.3)} Z')
    lining = (f'M{f(hcx - r * 0.42)} {f(hcy + r * 0.16)} Q{f(hcx - r * 0.48)} {f(hcy - r * 0.32)} {f(hcx + r * 0.05)} {f(hcy - r * 0.3)} '
              f'Q{f(hcx + r * 0.46)} {f(hcy - r * 0.24)} {f(hcx + r * 0.42)} {f(hcy + r * 0.12)} Q{f(hcx)} {f(hcy + r * 0.3)} {f(hcx - r * 0.42)} {f(hcy + r * 0.16)} Z')
    hoodg = shape(hood, c, stroke(f'M{f(hcx - r * 0.55)} {f(hcy - r * 0.25)} Q{f(hcx)} {f(hcy - r * 0.68)} {f(hcx + r * 0.45)} {f(hcy - r * 0.35)}', '#ffffff', 2.2, opacity=0.5))
    hoodg += shape(lining, shade(c, 0.3), outline=shade(c, 0.45), width=1.2)
    return {'body': body, 'hood': hoodg}


def hoodie(p, c, d_):
    o = 2.5
    ur = -0.82
    P0, P1, B1 = p.top(ur, o), p.top(0.93, o), p.bot(0.82, o)
    xr = P0[0]
    hem = (f'Q{f(p.cx + p.L * 0.3)} {f(p.cy + p.ry + o + 1)} {f(p.cx - p.L * 0.2)} {f(p.cy + p.ry * 0.92)} '
           f'Q{f(p.cx - p.L * 0.62)} {f(p.cy + p.ry * 0.82)} {f(xr + 1)} {f(p.cy + p.ry * 0.42)} '
           f'Q{f(xr - 3)} {f(p.cy - p.ry * 0.2)} {pt(P0)}')
    d = f'M{pt(P0)} {p.arc(P1, o)} {p.arc(B1, o)} {hem} Z'
    band = shade(c, 0.1)
    det = stroke(f'M{pt(B1)} {hem}', band, 7) + stroke(f'M{pt(B1)} {hem}', shade(band, 0.15), 7, dash='1.2 2.4', cap='butt')
    det += stroke(f'M{pt(p.top(-0.6, -4))} Q{pt((p.cx, p.cy - p.ry - 3))} {pt(p.top(0.6, -4))}', light(c, 0.4), 2.2, opacity=0.75)
    px0, px1 = p.cx - p.L * 0.12, p.cx + p.L * 0.42
    py0, py1 = p.cy + p.ry * 0.1, p.cy + p.ry * 0.62
    pocket = f'M{f(px0)} {f(py0)} L{f(px1)} {f(py0)} Q{f(px1 + 7)} {f(py0)} {f(px1 + 5)} {f(py1)} L{f(px0 + 2)} {f(py1)} Q{f(px0 - 6)} {f((py0 + py1) / 2)} {f(px0)} {f(py0)} Z'
    det += shape(pocket, light(c, 0.22), stroke(f'M{f(px0 + 2)} {f(py0 + 2.5)} L{f(px1 - 1)} {f(py0 + 2.5)}', d_, 1.3, dash='2 2'), outline=shade(c, 0.3), width=1.6)
    body = shape(d, c, det)
    hx, hy, r = p.hx, p.hy, p.hr
    hcx, hcy = hx - r * 0.78, hy + r * 0.58
    inner = light(c, 0.45)
    hood = ''
    for ex in (-0.42, 0.12):
        hood += circle(hcx + r * ex, hcy - r * 0.52, r * 0.2, c)
        hood += circle(hcx + r * ex, hcy - r * 0.52, r * 0.1, inner, outline=False)
    hood += ellipse(hcx, hcy, r * 0.64, r * 0.5, c)
    hood += stroke(f'M{f(hcx - r * 0.35)} {f(hcy + r * 0.05)} Q{f(hcx)} {f(hcy + r * 0.3)} {f(hcx + r * 0.4)} {f(hcy - r * 0.05)}', shade(c, 0.25), 1.6)
    hood += stroke(f'M{f(hcx - r * 0.45)} {f(hcy - r * 0.2)} Q{f(hcx - r * 0.1)} {f(hcy - r * 0.42)} {f(hcx + r * 0.3)} {f(hcy - r * 0.32)}', '#ffffff', 2, opacity=0.5)
    neck = ''
    for (sx, sy, ln) in ((hx - r * 0.2, hy + r * 0.92, 13), (hx + r * 0.1, hy + r * 0.96, 11)):
        neck += stroke(f'M{f(sx)} {f(sy)} Q{f(sx + 1.5)} {f(sy + ln * 0.5)} {f(sx + 0.5)} {f(sy + ln)}', light(c, 0.55), 1.6)
        neck += f'<rect x="{f(sx - 0.8)}" y="{f(sy + ln - 1)}" width="2.8" height="5.2" rx="1.4" fill="{d_}" stroke="{ol(d_)}" stroke-width="1"/>'
    return {
        'body': body,
        'near': sleeve(p, p.nf, c, band, False, 0.8),
        'far': sleeve(p, p.ff, c, band, True, 0.8),
        'hood': hood,
        'neck': neck,
    }


def icon_vb(p, pad=10):
    x0 = p.cx - p.L - 14
    x1 = p.hx + p.hr * 0.6
    y0 = p.cy - p.ry - 16
    y1 = p.ground - 2
    return (x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad)


def jacket_icon(p, g):
    return g.get('far', '') + g.get('hood', '') + g.get('body', '') + g.get('near', '') + g.get('neck', '')


JACKETS = {
    'sweater': lambda p: sweater(p, '#d64545', '#f4dede'),
    'puffer': lambda p: puffer(p, '#f28c28', '#ffe0c2'),
    'vest': lambda p: vest(p, '#3b6fc4'),
    'raincoat': lambda p: raincoat(p, '#f2c230'),
    'hoodie': lambda p: hoodie(p, '#FF9FCB', '#8A5AD6'),
}

for name, fn in JACKETS.items():
    g = fn(STD)
    save(f'j-{name}-pet.svg', pet_vb(STD), STD.render(g))
    # icon: the garment alone, no ghost pet; leg-shaped sleeves read as sleeves on their own
    gi = dict(g)
    gi['neck'] = ''
    save(f'j-{name}-icon.svg', icon_vb(STD), jacket_icon(STD, gi))

for name, fn in (('sweater', lambda p: sweater(p, '#B9A2F5', '#F1EBFF')),
                 ('puffer', lambda p: puffer(p, '#FF8CC4', None, rainbow=True)),
                 ('hoodie', lambda p: hoodie(p, '#FF9FCB', '#8A5AD6')),
                 ('raincoat', lambda p: raincoat(p, '#f2c230'))):
    save(f'jl-{name}.svg', pet_vb(LONG), LONG.render(fn(LONG)))

# ---------------------------------------------------------------- hats (local: origin = hat base centre, y up is negative)


def hat_beanie(c, d_=None):
    pom = d_ or light(c, 0.45)
    dome = 'M-19 -4 C-21 -24 -8 -31 3 -30 C14 -29 21 -20 19 -4 Z'
    ribs = ''.join(stroke(f'M{x} -6 L{x * 0.8:.1f} -28', shade(c, 0.12), 1.3) for x in (-12, -6, 0, 6, 12))
    o = shape(dome, c, ribs + stroke('M-12 -22 Q-4 -28 6 -26', light(c, 0.4), 2.2, opacity=0.75))
    cuff = 'M-21 -9 Q0 -12 21 -9 L21 0 Q0 3 -21 0 Z'
    o += shape(cuff, shade(c, 0.14), stroke('M-21 -4.5 Q0 -6 21 -4.5', shade(c, 0.3), 9, dash='1.3 2.4', cap='butt'))
    o += circle(-2, -33, 7.5, pom)
    o += stroke('M-6 -35 Q-2 -39 2 -36 M-3 -30 Q1 -32 4 -29', shade(pom, 0.15), 1.1, opacity=0.8)
    return o


def hat_party(c, d_):
    cone = 'M-13 0 L13 0 L1 -42 Z'
    stripes = ''.join(stroke(f'M-20 {y} L20 {y - 9}', d_, 4.5) for y in (-4, -14, -24, -34))
    o = shape(cone, c, stripes, width=OW)
    o += shape('M-14 -3 Q0 -5 14 -3 L14 2 Q0 4 -14 2 Z', d_)
    o += circle(1, -44, 5.5, d_)
    o += stroke('M12 1 Q20 20 14 44', '#ffffff', 1.1, opacity=0.6)
    return o


def hat_top(c, d_):
    o = shape('M-16 -1 Q0 -6 16 -1 Q16 4 0 4 Q-16 4 -16 -1 Z', c)
    o += shape('M-9.5 -2 L-9 -27 Q0 -29 9 -27 L9.5 -2 Q0 0 -9.5 -2 Z', c, stroke('M-5 -24 L-5 -8', light(c, 0.35), 2, opacity=0.8))
    o += shape('M-9.5 -9 Q0 -11 9.5 -9 L9.5 -3 Q0 -1 -9.5 -3 Z', d_)
    return o


def hat_cap(c, d_):
    o = shape('M8 -3 C22 -6 34 -2 35 3 C27 7 16 6 7 3 Z', d_)
    o += shape('M-18 0 C-19 -22 18 -24 18 0 Z', c, stroke('M0 -18 Q-6 -10 -8 0 M0 -18 Q6 -10 8 0', shade(c, 0.22), 1.4) + stroke('M-11 -14 Q-4 -20 4 -19', light(c, 0.4), 2.2, opacity=0.75))
    o += circle(0, -19.5, 2.6, d_)
    return o


def hat_bucket(c, d_):
    o = shape('M-12.5 -3 C-13 -20 13 -20 12.5 -3 Z', c, stroke('M-8 -14 Q-2 -18 5 -17', light(c, 0.4), 2, opacity=0.75))
    o += shape('M-13 -7 Q0 -9 13 -7 L13 -2 Q0 0 -13 -2 Z', d_)
    brim = 'M-25 3 C-21 -4 21 -4 25 3 C27 7 21 9 14 6.5 C6 4.5 -6 4.5 -14 6.5 C-21 9 -27 7 -25 3 Z'
    o += shape(brim, c, stroke('M-21 3.5 C-12 -0.5 12 -0.5 21 3.5', shade(c, 0.25), 1.2, dash='2 1.8'))
    return o


def hat_beret(c):
    o = '<g transform="rotate(-10)">'
    o += shape('M-23 -6 C-22 -16 22 -18 24 -7 C25 -1 -24 2 -23 -6 Z', c, stroke('M-14 -12 Q-2 -17 10 -14', light(c, 0.4), 2.2, opacity=0.7))
    o += shape('M-12 -2 Q0 -5 12 -2 L12 1 Q0 3 -12 1 Z', shade(c, 0.2))
    o += stroke('M4 -14 Q5 -18 8 -19', ol(c), 3.6) + stroke('M4 -14 Q5 -18 8 -19', c, 1.6)
    o += '</g>'
    return o


def hat_crown(c, d_):
    o = shape('M-14 0 L-14 -14 L-7 -7 L0 -19 L7 -7 L14 -14 L14 0 Z', c, stroke('M-9 -10 L-6 -6', light(c, 0.5), 1.8, opacity=0.8))
    o += shape('M-14.5 -5.5 L14.5 -5.5 L14.5 0.5 L-14.5 0.5 Z', shade(c, 0.14))
    for (x, y) in ((-14, -15.5), (0, -20.5), (14, -15.5)):
        o += circle(x, y, 2.3, c)
    for (x, col) in ((-8, d_), (0, '#5AA9E6'), (8, d_)):
        o += ellipse(x, -2.5, 2.4, 1.8, col)
    o += f'<path d="M0 -13 L2.4 -10 L0 -7 L-2.4 -10 Z" fill="{d_}" stroke="{ol(d_)}" stroke-width="1.2"/>'
    return o


HATS = {
    'beanie': hat_beanie('#2f9e6b'),
    'party': hat_party('#8a5ad6', '#ffd34d'),
    'top': hat_top('#26262c', '#f4dede'),
    'cap': hat_cap('#D64545', '#B23434'),
    'bucket': hat_bucket('#FFC93C', '#E0A01E'),
    'beret': hat_beret('#E85A8C'),
    'crown': hat_crown('#FFC93C', '#FF5FA2'),
}

P = STD
ax, ay = P.hx + P.hr * 0.02, P.hy - P.hr * 0.78
head_vb = (P.hx - P.hr * 1.25, P.hy - P.hr * 2.55, P.hr * 2.75, P.hr * 3.75)
for name, art in HATS.items():
    hat = f'<g transform="translate({f(ax)} {f(ay)}) rotate(-10)">{art}</g>'
    save(f'h-{name}-pet.svg', head_vb, P.render({'hat': hat}))
    save(f'h-{name}-icon.svg', (-32, -54, 70, 66), f'<g transform="rotate(-6)">{art}</g>')

# ---------------------------------------------------------------- neckwear (on the throat under the chin)

hx, hy, r = P.hx, P.hy, P.hr
A = (hx - r * 0.74, hy + r * 0.6)
Cc = (hx - r * 0.12, hy + r * 1.28)
B = (hx + r * 0.46, hy + r * 0.96)
BAND = f'M{pt(A)} Q{pt(Cc)} {pt(B)}'


def qpt(t):
    return (((1 - t) ** 2) * A[0] + 2 * (1 - t) * t * Cc[0] + t * t * B[0], ((1 - t) ** 2) * A[1] + 2 * (1 - t) * t * Cc[1] + t * t * B[1])


LOW = qpt(0.52)


def heart(cx, cy, s, fill):
    d = (f'M{f(cx)} {f(cy + s * 0.9)} C{f(cx - s * 1.3)} {f(cy + s * 0.1)} {f(cx - s * 0.9)} {f(cy - s * 0.9)} {f(cx)} {f(cy - s * 0.35)} '
         f'C{f(cx + s * 0.9)} {f(cy - s * 0.9)} {f(cx + s * 1.3)} {f(cy + s * 0.1)} {f(cx)} {f(cy + s * 0.9)} Z')
    return shape(d, fill, stroke(f'M{f(cx - s * 0.55)} {f(cy - s * 0.3)} Q{f(cx - s * 0.4)} {f(cy - s * 0.6)} {f(cx - s * 0.1)} {f(cy - s * 0.45)}', '#ffffff', 1.3, opacity=0.7))


def collar(c, d_, accent):
    wband = r * 0.27
    o = outlined(BAND, c, wband)
    o += stroke(BAND, light(c, 0.3), 1.4, opacity=0.8)
    if accent == 'studs':
        for t in (0.16, 0.34, 0.52, 0.7, 0.88):
            x, y = qpt(t)
            o += f'<path d="M{f(x)} {f(y - 2.4)} L{f(x + 2.4)} {f(y)} L{f(x)} {f(y + 2.4)} L{f(x - 2.4)} {f(y)} Z" fill="{d_}" stroke="{ol(c)}" stroke-width="0.9"/>'
    ring = (LOW[0], LOW[1] + wband * 0.4)
    o += f'<circle cx="{f(ring[0])}" cy="{f(ring[1] + 1.5)}" r="2.2" fill="none" stroke="{ol(d_)}" stroke-width="1.4"/>'
    if accent == 'bell':
        br = r * 0.24
        bx, by = ring[0], ring[1] + 3.5 + br
        o += circle(bx, by, br, d_)
        o += stroke(f'M{f(bx - br * 0.8)} {f(by - br * 0.15)} L{f(bx + br * 0.8)} {f(by - br * 0.15)}', ol(d_), 1.3)
        o += f'<path d="M{f(bx)} {f(by + br * 0.2)} L{f(bx)} {f(by + br * 0.85)}" stroke="{ol(d_)}" stroke-width="1.8" stroke-linecap="round"/>'
        o += stroke(f'M{f(bx - br * 0.55)} {f(by - br * 0.4)} Q{f(bx - br * 0.2)} {f(by - br * 0.75)} {f(bx + br * 0.1)} {f(by - br * 0.7)}', '#ffffff', 1.4, opacity=0.75)
    else:
        o += heart(ring[0], ring[1] + 3.5 + r * 0.24, r * 0.24, d_)
    return o


def bandana(c):
    deep = shade(c, 0.2)
    bandc = shade(c, 0.12)
    t1, t2 = qpt(0.22), qpt(0.96)
    mid = ((t1[0] + t2[0]) / 2, (t1[1] + t2[1]) / 2)
    tip = (mid[0] + r * 0.05, mid[1] + r * 1.05)
    cloth = f'M{pt(t1)} L{pt(t2)} Q{f((t2[0] + tip[0]) / 2 + 3)} {f((t2[1] + tip[1]) / 2)} {pt(tip)} Q{f((t1[0] + tip[0]) / 2 - 3)} {f((t1[1] + tip[1]) / 2)} {pt(t1)} Z'
    hem = f'M{pt(t1)} Q{f((t1[0] + tip[0]) / 2 - 3)} {f((t1[1] + tip[1]) / 2)} {pt(tip)} Q{f((t2[0] + tip[0]) / 2 + 3)} {f((t2[1] + tip[1]) / 2)} {pt(t2)}'
    o = ''
    for (dx, dy) in ((-r * 0.34, r * 0.18), (-r * 0.16, r * 0.38)):
        o += outlined(f'M{pt(A)} L{f(A[0] + dx)} {f(A[1] + dy)}', c, r * 0.13)
    o += circle(A[0], A[1], r * 0.12, bandc)
    o += shape(cloth, c, stroke(hem, deep, 4.5) + stroke(f'M{f(t1[0] + 4)} {f(t1[1] + 3)} L{f(t2[0] - 4)} {f(t2[1] + 3)}', '#000000', 3, opacity=0.14) +
               stroke(f'M{f(mid[0] - 6)} {f(mid[1] + 8)} Q{f(mid[0] - 2)} {f(mid[1] + 4)} {f(mid[0] + 3)} {f(mid[1] + 6)}', light(c, 0.4), 1.8, opacity=0.7))
    o += outlined(BAND, bandc, r * 0.17)
    return o


def scarf(c):
    shadowc = shade(c, 0.2)
    o = ''
    knot = qpt(0.6)
    for (ex, ey, wd) in ((knot[0] - r * 0.22, knot[1] + r * 0.95, r * 0.3), (knot[0] + r * 0.18, knot[1] + r * 0.82, r * 0.28)):
        d = f'M{f(knot[0] - wd / 2)} {f(knot[1])} L{f(knot[0] + wd / 2)} {f(knot[1])} L{f(ex + wd / 2)} {f(ey)} L{f(ex - wd / 2)} {f(ey)} Z'
        det = stroke(f'M{f(ex - wd)} {f(ey - 7)} L{f(ex + wd)} {f(ey - 7)}', light(c, 0.45), 2.6)
        o += shape(d, c, det)
        for k in (-0.35, 0, 0.35):
            o += stroke(f'M{f(ex + k * wd)} {f(ey)} L{f(ex + k * wd)} {f(ey + 3.5)}', shadowc, 1.6)
    o += stroke(BAND, ol(c), r * 0.42 + OW) + stroke(BAND, c, r * 0.42)
    o += stroke(BAND, shadowc, r * 0.42, dash='1.3 2.6', cap='butt', opacity=0.55)
    o += stroke(f'M{pt(qpt(0.08))} Q{pt((Cc[0], Cc[1] - r * 0.12))} {pt(qpt(0.9))}', light(c, 0.4), 1.8, opacity=0.8)
    o += ellipse(knot[0], knot[1] + 1, r * 0.2, r * 0.16, c)
    return o


def bow(c):
    k = (LOW[0] + r * 0.02, LOW[1] + 1)
    o = outlined(BAND, c, r * 0.1)
    for sgn in (-1, 1):
        tail = f'M{f(k[0])} {f(k[1])} L{f(k[0] + sgn * r * 0.12)} {f(k[1] + r * 0.62)} L{f(k[0] + sgn * r * 0.26)} {f(k[1] + r * 0.52)} L{f(k[0] + sgn * r * 0.36)} {f(k[1] + r * 0.66)} L{f(k[0] + sgn * r * 0.2)} {f(k[1])} Z'
        o += shape(tail, shade(c, 0.08))
    for sgn in (-1, 1):
        loop = f'M{f(k[0])} {f(k[1])} C{f(k[0] + sgn * r * 0.35)} {f(k[1] - r * 0.55)} {f(k[0] + sgn * r * 0.75)} {f(k[1] - r * 0.4)} {f(k[0] + sgn * r * 0.62)} {f(k[1] + r * 0.05)} C{f(k[0] + sgn * r * 0.5)} {f(k[1] + r * 0.32)} {f(k[0] + sgn * r * 0.2)} {f(k[1] + r * 0.12)} {f(k[0])} {f(k[1])} Z'
        fold = stroke(f'M{f(k[0] + sgn * r * 0.12)} {f(k[1] - r * 0.02)} Q{f(k[0] + sgn * r * 0.4)} {f(k[1] - r * 0.25)} {f(k[0] + sgn * r * 0.55)} {f(k[1] - r * 0.05)}', shade(c, 0.22), 1.6)
        o += shape(loop, c, fold)
    o += ellipse(k[0], k[1], r * 0.13, r * 0.15, shade(c, 0.15))
    o += stroke(f'M{f(k[0] - r * 0.45)} {f(k[1] - r * 0.25)} Q{f(k[0] - r * 0.35)} {f(k[1] - r * 0.38)} {f(k[0] - r * 0.2)} {f(k[1] - r * 0.3)}', '#ffffff', 1.6, opacity=0.6)
    return o


def bowtie(c, d_):
    k = (LOW[0] + r * 0.02, LOW[1] + 1)
    o = outlined(BAND, c, r * 0.11)
    for sgn in (-1, 1):
        wing = f'M{f(k[0])} {f(k[1])} L{f(k[0] + sgn * r * 0.55)} {f(k[1] - r * 0.28)} Q{f(k[0] + sgn * r * 0.64)} {f(k[1])} {f(k[0] + sgn * r * 0.55)} {f(k[1] + r * 0.28)} Z'
        o += shape(wing, c, stroke(f'M{f(k[0] + sgn * r * 0.15)} {f(k[1] - r * 0.05)} L{f(k[0] + sgn * r * 0.42)} {f(k[1] - r * 0.12)}', light(c, 0.3), 1.4, opacity=0.8))
    o += f'<rect x="{f(k[0] - r * 0.11)}" y="{f(k[1] - r * 0.13)}" width="{f(r * 0.22)}" height="{f(r * 0.26)}" rx="2" fill="{d_}" stroke="{ol(d_)}" stroke-width="{OW}"/>'
    return o


NECK = {
    'collar': collar('#d64545', '#f0c94a', 'tag'),
    'bell': collar('#6b3a2a', '#f0c94a', 'bell'),
    'gold': collar('#e0b43c', '#fff3c4', 'studs'),
    'bandana': bandana('#3b6fc4'),
    'scarf': scarf('#e8c53a'),
    'bow': bow('#e85a8c'),
    'bowtie': bowtie('#2B3A6B', '#F0C94A'),
}
neck_vb = (hx - r * 1.4, hy - r * 1.2, r * 2.9, r * 3.3)
neck_icon_vb = (hx - r * 1.2, hy + r * 0.25, r * 2.0, r * 1.85)
for name, art in NECK.items():
    save(f'n-{name}-pet.svg', neck_vb, P.render({'neck': art}))
    save(f'n-{name}-icon.svg', neck_icon_vb, art)

# ---------------------------------------------------------------- boots


def boot(x, g, w, kind, c, d_, far):
    tone = (lambda col: shade(col, 0.3)) if far else (lambda col: col)
    col = tone(c)
    height = {'red': 21, 'rain': 23, 'sneaker': 11, 'high': 19}[kind]
    top = g - height
    sx0, sx1 = x - w / 2 - 1.6, x + w / 2 + 1.6
    toe = x + w / 2 + 7.5
    dpath = (f'M{f(sx0)} {f(top)} L{f(sx1)} {f(top)} L{f(sx1)} {f(g - 9)} Q{f(toe + 0.5)} {f(g - 9.5)} {f(toe)} {f(g - 3.5)} '
             f'Q{f(toe)} {f(g)} {f(toe - 4)} {f(g)} L{f(sx0 + 2)} {f(g)} Q{f(sx0)} {f(g)} {f(sx0)} {f(g - 3)} Z')
    det = ''
    o = ''
    if kind == 'red':
        det += f'<rect x="{f(sx0 - 5)}" y="{f(g - 3.6)}" width="{f(toe - sx0 + 10)}" height="6" fill="{tone(shade(c, 0.55))}"/>'
        det += stroke(f'M{f(toe - 6)} {f(g - 7.5)} Q{f(toe - 3)} {f(g - 8)} {f(toe - 1.5)} {f(g - 5.5)}', light(col, 0.45), 1.6, opacity=0.9)
        o += shape(dpath, col, det)
        cuff = f'M{f(sx0 - 1.4)} {f(top - 1.2)} L{f(sx1 + 1.4)} {f(top - 1.2)} L{f(sx1 + 1.4)} {f(top + 5)} Q{f(x)} {f(top + 7.5)} {f(sx0 - 1.4)} {f(top + 5)} Z'
        o += shape(cuff, tone(shade(c, 0.22)))
    elif kind == 'rain':
        sole = tone(d_ or shade(c, 0.5))
        det += f'<rect x="{f(sx0 - 5)}" y="{f(g - 4.6)}" width="{f(toe - sx0 + 10)}" height="7" fill="{sole}"/>'
        det += ''.join(stroke(f'M{f(xx)} {f(g - 2.4)} L{f(xx)} {f(g + 1)}', shade(sole, 0.35), 1.1) for xx in (sx0 + 3, sx0 + 7, sx0 + 11, sx0 + 15))
        det += stroke(f'M{f(sx1 - 3)} {f(top + 3)} L{f(sx1 - 3)} {f(g - 10)}', '#ffffff', 2, opacity=0.55)
        det += f'<rect x="{f(sx0 - 2)}" y="{f(top - 1)}" width="{f(sx1 - sx0 + 4)}" height="3.2" fill="{tone(shade(c, 0.25))}"/>'
        o += stroke(f'M{f(sx0 + 1)} {f(top + 1)} Q{f(sx0 - 2)} {f(top - 2.5)} {f(sx0 + 2)} {f(top - 2.8)}', ol(col), 3.2) + stroke(f'M{f(sx0 + 1)} {f(top + 1)} Q{f(sx0 - 2)} {f(top - 2.5)} {f(sx0 + 2)} {f(top - 2.8)}', tone(shade(c, 0.15)), 1.4)
        o += shape(dpath, col, det)
    else:
        sole = tone('#e4e1dc')
        acc = tone(d_)
        det += f'<rect x="{f(sx0 - 5)}" y="{f(g - 4.4)}" width="{f(toe - sx0 + 10)}" height="7" fill="{sole}"/>'
        det += stroke(f'M{f(sx0 - 4)} {f(g - 4.4)} L{f(toe + 4)} {f(g - 4.4)}', shade(sole, 0.25), 1)
        det += stroke(f'M{f(sx0 + 1)} {f(g - 6.5)} Q{f(x + 2)} {f(g - 7)} {f(toe - 3)} {f(g - 11)}', acc, 2.2)
        det += stroke(f'M{f(sx0 + 1)} {f(g - 9.2)} Q{f(x + 1)} {f(g - 9.6)} {f(sx1 + 1)} {f(top + 2.5)}', acc, 1.6)
        for i in range(3 if kind == 'high' else 2):
            ly = top + 3 + i * 3.6
            det += stroke(f'M{f(sx1 - 4.5)} {f(ly)} L{f(sx1 + 0.5)} {f(ly + 1.4)}', ol(col), 1.2)
        o += shape(f'M{f(sx0 - 0.5)} {f(top + 2)} Q{f(x)} {f(top - 2.2)} {f(sx1 + 0.5)} {f(top + 2)} L{f(sx1)} {f(top + 4)} L{f(sx0)} {f(top + 4)} Z', tone(shade(c, 0.08)))
        o += shape(dpath, col, det)
    return o


def boots_on(p, kind, c, d_):
    out = {'far': '', 'near': ''}
    for x, far in ((p.fr, True), (p.ff, True), (p.nr, False), (p.nf, False)):
        out['far' if far else 'near'] += boot(x, p.ground, p.w, kind, c, d_, far)
    return out


BOOTS = {
    'red': ('red', '#d64545', None),
    'rain': ('rain', '#f2c230', '#f7f7f7'),
    'sneaker': ('sneaker', '#f4f4f4', '#d64545'),
    'high': ('high', '#E0B43C', '#FFF3C4'),
}
for name, (kind, c, d_) in BOOTS.items():
    if name != 'high':
        save(f'b-{name}-pet.svg', pet_vb(STD), STD.render(boots_on(STD, kind, c, d_)))
    OW = 1.3
    pair = boot(18, 40, 12.6, kind, c, d_, True) + boot(32, 42, 12.6, kind, c, d_, False)
    OW = 2.2
    save(f'b-{name}-icon.svg', (0, 10, 56, 38), pair)

print(len(os.listdir(OUT)), 'files')
