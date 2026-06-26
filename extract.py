import json

SKETCH_PAGE = 'sketch_unzipped/pages/3EA74768-D74F-433E-8E1A-692473709370.json'

with open(SKETCH_PAGE, 'r', encoding='utf-8') as f:
    data = json.load(f)

def parse_point(s):
    s = s.strip('{}')
    x, y = map(float, s.split(', '))
    return x, y

def sketch_path_to_svg_d(points, width, height, is_closed):
    if not points:
        return ''
    def scale(pt): return (pt[0] * width, pt[1] * height)
    segs = []
    first = scale(parse_point(points[0]['point']))
    segs.append('M %.4f %.4f' % (first[0], first[1]))
    for i in range(1, len(points)):
        prev = points[i - 1]
        curr = points[i]
        cp1 = scale(parse_point(prev['curveFrom']))
        cp2 = scale(parse_point(curr['curveTo']))
        pt = scale(parse_point(curr['point']))
        segs.append('C %.4f %.4f, %.4f %.4f, %.4f %.4f' % (cp1[0], cp1[1], cp2[0], cp2[1], pt[0], pt[1]))
    if is_closed:
        prev = points[-1]
        curr = points[0]
        cp1 = scale(parse_point(prev['curveFrom']))
        cp2 = scale(parse_point(curr['curveTo']))
        pt = scale(parse_point(curr['point']))
        segs.append('C %.4f %.4f, %.4f %.4f, %.4f %.4f' % (cp1[0], cp1[1], cp2[0], cp2[1], pt[0], pt[1]))
        segs.append('Z')
    return ' '.join(segs)

def get_fill_color(style):
    try:
        c = style['fills'][0]['color']
        r = int(c['red'] * 255)
        g = int(c['green'] * 255)
        b = int(c['blue'] * 255)
        a = c.get('alpha', 1)
        if a < 1:
            return 'rgba(%d,%d,%d,%.2f)' % (r, g, b, a)
        return 'rgb(%d,%d,%d)' % (r, g, b)
    except (KeyError, IndexError, TypeError):
        return '#FFFFFF'

def render_shape_path(sp, dx, dy):
    f = sp.get('frame', {})
    x = dx + f.get('x', 0)
    y = dy + f.get('y', 0)
    w = f.get('width', 0)
    h = f.get('height', 0)
    d = sketch_path_to_svg_d(sp.get('points', []), w, h, sp.get('isClosed', False))
    fill = get_fill_color(sp.get('style', {}))
    return '<path transform="translate(%.4f %.4f)" d="%s" fill="%s"/>' % (x, y, d, fill)

def render_shape_group(sg, dx, dy):
    sg_frame = sg.get('frame', {})
    gx = dx + sg_frame.get('x', 0)
    gy = dy + sg_frame.get('y', 0)
    fill = get_fill_color(sg.get('style', {}))
    winding = sg.get('style', {}).get('windingRule', 1)
    fill_rule = 'evenodd' if winding == 1 else 'nonzero'
    
    parts = []
    for child in sg.get('layers', []):
        if child.get('_class') == 'shapePath':
            cf = child.get('frame', {})
            cx = cf.get('x', 0)
            cy = cf.get('y', 0)
            cw = cf.get('width', 0)
            ch = cf.get('height', 0)
            pts = child.get('points', [])
            
            if not pts: continue
            
            def scale_offset(pt): return (pt[0]*cw + cx, pt[1]*ch + cy)
            
            first = scale_offset(parse_point(pts[0]['point']))
            parts.append('M %.4f %.4f' % (first[0], first[1]))
            
            for i in range(1, len(pts)):
                prev = pts[i - 1]
                curr = pts[i]
                cp1 = scale_offset(parse_point(prev['curveFrom']))
                cp2 = scale_offset(parse_point(curr['curveTo']))
                pt = scale_offset(parse_point(curr['point']))
                parts.append('C %.4f %.4f, %.4f %.4f, %.4f %.4f' % (cp1[0], cp1[1], cp2[0], cp2[1], pt[0], pt[1]))
            
            if child.get('isClosed', False):
                prev = pts[-1]
                curr = pts[0]
                cp1 = scale_offset(parse_point(prev['curveFrom']))
                cp2 = scale_offset(parse_point(curr['curveTo']))
                pt = scale_offset(parse_point(curr['point']))
                parts.append('C %.4f %.4f, %.4f %.4f, %.4f %.4f' % (cp1[0], cp1[1], cp2[0], cp2[1], pt[0], pt[1]))
                parts.append('Z')
                
    if not parts: return ''
    return '<path transform="translate(%.4f %.4f)" fill="%s" fill-rule="%s" d="%s"/>' % (gx, gy, fill, fill_rule, ' '.join(parts))

for artboard_name in ('浅色-logo', '深色-logo'):
    for layer in data.get('layers', []):
        if layer.get('name') != artboard_name:
            continue
        frame = layer.get('frame', {})
        w = frame.get('width', 1620)
        h = frame.get('height', 851)
        svg_lines = ['<svg width="%d" height="%d" viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg">' % (w, h, w, h)]
        if '深色' in artboard_name:
            bg = layer.get('backgroundColor', {})
            if bg:
                r = int(bg.get('red', 0) * 255)
                g = int(bg.get('green', 0) * 255)
                b = int(bg.get('blue', 0) * 255)
                svg_lines.append('<rect width="%d" height="%d" fill="rgb(%d,%d,%d)"/>' % (w, h, r, g, b))

        def process_layer(obj, dx=0, dy=0):
            cls = obj.get('_class')
            obj_frame = obj.get('frame', {})
            x = dx + obj_frame.get('x', 0)
            y = dy + obj_frame.get('y', 0)
            if cls == 'shapePath':
                svg_lines.append(render_shape_path(obj, dx, dy))
            elif cls == 'shapeGroup':
                svg_lines.append(render_shape_group(obj, dx, dy))
            elif cls in ('group', 'artboard'):
                offset_x = x if cls == 'group' else 0
                offset_y = y if cls == 'group' else 0
                for child in obj.get('layers', []):
                    process_layer(child, offset_x, offset_y)
                    
        for child in layer.get('layers', []):
            process_layer(child)
        svg_lines.append('</svg>')
        
        suffix = 'light' if '浅色' in artboard_name else 'dark'
        filename = 'medcaptian_logo_%s.svg' % suffix
        with open(filename, 'w', encoding='utf-8') as f:
            f.write('\n'.join(svg_lines))
        print('Created', filename)