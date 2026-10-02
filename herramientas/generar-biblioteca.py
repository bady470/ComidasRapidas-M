#!/usr/bin/env python3
"""Genera la biblioteca de productos precargados (catalogo.txt + imágenes PNG ilustradas).

Uso (desde la raíz del repo):  python3 herramientas/generar-biblioteca.py
Requiere Playwright con Chromium para convertir las ilustraciones SVG a PNG.
Las imágenes son ilustraciones propias; el superadmin o cada empresa puede reemplazarlas por fotos reales.
"""
import json, pathlib, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "backend/src/main/resources/catalogo-base"
IMG = SALIDA / "img"

# ----------------------------------------------------------------- ilustraciones (SVG 600x450)
def marco(fondo1, fondo2, cuerpo):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450">
<defs><radialGradient id="f" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="{fondo1}"/><stop offset="1" stop-color="{fondo2}"/></radialGradient>
<filter id="s" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#000" flood-opacity=".28"/></filter></defs>
<rect width="600" height="450" fill="url(#f)"/>
<circle cx="90" cy="70" r="120" fill="#fff" opacity=".07"/><circle cx="540" cy="400" r="150" fill="#fff" opacity=".06"/>
{cuerpo}</svg>'''

def plato(): return '<ellipse cx="300" cy="300" rx="230" ry="62" fill="#fff" filter="url(#s)"/><ellipse cx="300" cy="294" rx="196" ry="46" fill="#f1ece6"/>'

def hamburguesa(carnes=1, extra=(), pan="#e0a04a", carne="#5a2e1b", pollo=False):
    y = 300; s = plato()
    s += f'<g filter="url(#s)"><path d="M150 {y-30} Q150 {y+5} 190 {y+8} L410 {y+8} Q450 {y+5} 450 {y-30} Z" fill="{pan}"/>'
    capas = []
    cy = y - 28
    capas.append(("pan_b",))
    for i in range(carnes):
        if pollo: s += f'<rect x="146" y="{cy-22}" width="308" height="26" rx="13" fill="#d98b3a"/><rect x="156" y="{cy-18}" width="288" height="8" rx="4" fill="#f2b45f" opacity=".7"/>'
        else: s += f'<rect x="146" y="{cy-22}" width="308" height="26" rx="13" fill="{carne}"/><rect x="160" y="{cy-18}" width="280" height="7" rx="3" fill="#8a4a2c" opacity=".7"/>'
        cy -= 24
        if "queso" in extra: s += f'<path d="M142 {cy+4} L458 {cy+4} L430 {cy+24} L412 {cy+10} L380 {cy+28} L330 {cy+10} L290 {cy+26} L240 {cy+8} L200 {cy+24} L170 {cy+10} Z" fill="#ffc83a"/>'; cy -= 6
    if "tocineta" in extra:
        s += f'<path d="M140 {cy} q40 -14 80 0 t80 0 t80 0 t80 0" stroke="#b5392a" stroke-width="12" fill="none" stroke-linecap="round"/>'; cy -= 12
    if "lechuga" in extra: s += f'<path d="M136 {cy} q20 -16 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 v10 h-320z" fill="#58b84a"/>'; cy -= 12
    if "tomate" in extra: s += f'<rect x="150" y="{cy-6}" width="300" height="16" rx="8" fill="#e4452f"/>'; cy -= 14
    if "cebolla" in extra: s += f'<rect x="170" y="{cy-4}" width="260" height="10" rx="5" fill="#d8b4e2"/>'; cy -= 10
    if "pina" in extra: s += f'<rect x="160" y="{cy-6}" width="280" height="14" rx="7" fill="#f7d54a"/>'; cy -= 12
    if "huevo" in extra: s += f'<ellipse cx="300" cy="{cy}" rx="120" ry="12" fill="#fff"/><circle cx="300" cy="{cy-2}" r="20" fill="#ffb800"/>'; cy -= 12
    if "bbq" in extra: s += f'<path d="M170 {cy+2} q40 14 80 0 t80 0 t80 0" stroke="#6b2a14" stroke-width="9" fill="none" stroke-linecap="round"/>'
    top = cy - 6
    s += f'<path d="M150 {top} Q150 {top-92} 300 {top-98} Q450 {top-92} 450 {top} Z" fill="{pan}"/>'
    s += f'<path d="M190 {top-24} Q230 {top-70} 290 {top-72}" stroke="#fff" stroke-width="10" fill="none" opacity=".25" stroke-linecap="round"/>'
    for x, yy in ((230,top-50),(280,top-68),(330,top-56),(380,top-44),(250,top-28),(340,top-30)):
        s += f'<ellipse cx="{x}" cy="{yy}" rx="7" ry="3.5" fill="#fff3d6" transform="rotate(-20 {x} {yy})"/>'
    s += '</g>'
    return s

def papas_cesta(color="#f2c14e"):
    s = '<g filter="url(#s)">'
    for i, x in enumerate(range(190, 420, 22)):
        s += f'<rect x="{x}" y="{130 + (i%3)*10}" width="16" height="150" rx="6" fill="{color}" transform="rotate({(i-5)*4} {x} 280)"/>'
    s += '<path d="M170 250 L430 250 L408 380 Q300 396 192 380 Z" fill="#d6322b"/><rect x="170" y="244" width="260" height="14" rx="6" fill="#b32620"/><circle cx="300" cy="316" r="30" fill="#fff" opacity=".9"/></g>'
    return s

def salchipapa(variante="clasica"):
    s = plato().replace('rx="230"', 'rx="240"')
    s += '<g filter="url(#s)">'
    for i in range(26):
        x = 170 + (i*37) % 250; y = 262 - (i*17) % 52
        s += f'<rect x="{x}" y="{y}" width="14" height="86" rx="6" fill="#f2c14e" transform="rotate({(i*29)%90-45} {x} {y})"/>'
    for i in range(7):
        x = 190 + i*36; y = 250 - (i%2)*22
        s += f'<ellipse cx="{x}" cy="{y}" rx="30" ry="13" fill="#b4412b" transform="rotate({(i*23)%40-20} {x} {y})"/><ellipse cx="{x}" cy="{y-3}" rx="22" ry="5" fill="#d9674d" opacity=".7" transform="rotate({(i*23)%40-20} {x} {y})"/>'
    if variante in ("clasica", "queso", "mixta", "pollo", "criolla", "huevo"):
        s += '<path d="M180 232 q30 24 60 4 t60 4 t60 -4 t60 6 t40 -6 v18 h-300z" fill="#ffc83a" opacity=".92"/>'
    if variante in ("mixta", "pollo", "criolla"):
        for x, y in ((220,215),(260,225),(310,210),(360,225),(400,214)): s += f'<rect x="{x}" y="{y}" width="34" height="16" rx="6" fill="#e0a04a" transform="rotate(14 {x} {y})"/>'
    if variante in ("criolla", "huevo"):
        s += '<ellipse cx="300" cy="212" rx="38" ry="14" fill="#fff"/><circle cx="300" cy="209" r="13" fill="#ffb800"/>'
    s += '<path d="M200 200 q40 16 80 0 t80 0 t60 6" stroke="#d6322b" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M210 214 q40 14 80 0 t80 0" stroke="#fff3c4" stroke-width="7" fill="none" stroke-linecap="round" opacity=".95"/>'
    if variante in ("picante", "mexicana", "criolla"):
        for x in (230, 300, 370): s += f'<circle cx="{x}" cy="200" r="9" fill="#3a9d3a"/>'
    s += '</g>'
    return s

def perro(variante="clasico"):
    s = plato()
    s += '<g filter="url(#s)">'
    s += '<rect x="130" y="238" width="340" height="62" rx="31" fill="#e0a04a"/><rect x="130" y="238" width="340" height="30" rx="15" fill="#efbb66"/>'
    s += '<rect x="108" y="222" width="384" height="34" rx="17" fill="#b4412b"/><rect x="120" y="226" width="360" height="9" rx="4" fill="#d9674d" opacity=".7"/>'
    salsa = {"clasico": "#d6322b", "suizo": "#ffc83a", "americano": "#d6322b", "tropical": "#ffc83a", "picante": "#2f7d2f"}.get(variante, "#d6322b")
    s += f'<path d="M130 230 q30 -22 60 0 t60 0 t60 0 t60 0 t60 0" stroke="{salsa}" stroke-width="11" fill="none" stroke-linecap="round"/>'
    s += '<path d="M140 244 q30 -18 60 0 t60 0 t60 0 t60 0" stroke="#fff3c4" stroke-width="8" fill="none" stroke-linecap="round"/>'
    if variante in ("suizo", "tropical", "mexicano"):
        s += '<path d="M130 226 L470 226 L440 252 L400 236 L350 254 L300 236 L250 254 L200 238 L160 252 Z" fill="#ffc83a" opacity=".9"/>'
    if variante in ("americano", "suizo", "tropical", "hawaiano"):
        for x in range(150, 460, 22): s += f'<rect x="{x}" y="196" width="10" height="26" rx="4" fill="#e8c26a" transform="rotate({(x%7)*8-20} {x} 210)"/>'
    if variante in ("tropical",):
        for x in (180, 260, 340, 420): s += f'<rect x="{x}" y="206" width="30" height="16" rx="5" fill="#f7d54a"/>'
    if variante in ("picante", "mexicano"):
        for x in (190, 260, 330, 400): s += f'<circle cx="{x}" cy="214" r="9" fill="#3a9d3a"/>'
    s += '</g>'
    return s

def pizza(cobertura="pepperoni", entera=True):
    s = '<g filter="url(#s)"><circle cx="300" cy="235" r="188" fill="#c98a3d"/><circle cx="300" cy="235" r="168" fill="#e8504a" opacity=".9"/><circle cx="300" cy="235" r="158" fill="#ffd25a"/>'
    s += '<g stroke="#f1b83a" stroke-width="6" opacity=".55"><circle cx="300" cy="235" r="130" fill="none"/><circle cx="300" cy="235" r="80" fill="none"/></g>'
    pts = [(300,235),(220,180),(380,185),(235,290),(370,290),(300,140),(300,330),(160,235),(440,235),(230,235),(370,235),(300,190),(300,285)]
    for i,(x,y) in enumerate(pts):
        if cobertura == "pepperoni": s += f'<circle cx="{x}" cy="{y}" r="24" fill="#b4261f"/><circle cx="{x-6}" cy="{y-6}" r="6" fill="#d9574d" opacity=".7"/>'
        elif cobertura == "hawaiana":
            s += f'<rect x="{x-18}" y="{y-12}" width="36" height="24" rx="6" fill="{"#f7e03a" if i%2 else "#f0a0a0"}" transform="rotate({i*37} {x} {y})"/>'
        elif cobertura == "champinones": s += f'<path d="M{x-22} {y+8} Q{x-22} {y-20} {x} {y-20} Q{x+22} {y-20} {x+22} {y+8} Z" fill="#e9dcc6"/><rect x="{x-7}" y="{y+6}" width="14" height="14" fill="#d9c9aa"/>'
        elif cobertura == "vegetariana":
            c = ["#3a9d3a","#e4452f","#8a4fa0","#f7d54a"][i%4]; s += f'<circle cx="{x}" cy="{y}" r="14" fill="{c}"/><circle cx="{x}" cy="{y}" r="7" fill="#ffd25a" opacity=".6"/>'
        elif cobertura == "cuatro_quesos":
            c = ["#fff1c2","#f6c445","#e86d2f","#7aa86a"][i%4]; s += f'<path d="M{x-24} {y} L{x} {y-24} L{x+24} {y} L{x} {y+24} Z" fill="{c}" opacity=".95"/>'
        elif cobertura == "carnes":
            c = ["#8a3a24","#d9674d","#5a2e1b"][i%3]; s += f'<rect x="{x-16}" y="{y-12}" width="32" height="24" rx="10" fill="{c}" transform="rotate({i*53} {x} {y})"/>'
        elif cobertura == "pollo_bbq":
            s += f'<rect x="{x-18}" y="{y-12}" width="36" height="24" rx="9" fill="#f0c27a" transform="rotate({i*41} {x} {y})"/><path d="M{x-14} {y} q8 -8 16 0" stroke="#6b2a14" stroke-width="5" fill="none"/>'
        elif cobertura == "margarita":
            if i % 3 == 0: s += f'<ellipse cx="{x}" cy="{y}" rx="26" ry="18" fill="#fff"/>'
            elif i % 3 == 1: s += f'<path d="M{x} {y} q10 -22 24 -16 q-6 18 -24 16z" fill="#3a9d3a"/>'
        elif cobertura == "criolla":
            s += f'<rect x="{x-16}" y="{y-10}" width="32" height="20" rx="8" fill="{"#e8c26a" if i%2 else "#d6322b"}" transform="rotate({i*47} {x} {y})"/>'
    s += '<path d="M300 235 L300 47 M300 235 L462 141 M300 235 L462 329 M300 235 L300 423 M300 235 L138 329 M300 235 L138 141" stroke="#7a4a1c" stroke-width="3" opacity=".25"/></g>'
    return s

def alitas(salsa="#c8431c"):
    s = plato().replace('rx="196"', 'rx="206"')
    s += '<g filter="url(#s)">'
    for i,(x,y) in enumerate(((200,250),(270,235),(340,250),(410,236),(235,205),(310,195),(380,205))):
        s += f'<g transform="rotate({(i*31)%50-25} {x} {y})"><ellipse cx="{x}" cy="{y}" rx="46" ry="26" fill="{salsa}"/><ellipse cx="{x-8}" cy="{y-8}" rx="28" ry="8" fill="#fff" opacity=".22"/><rect x="{x+34}" y="{y-6}" width="34" height="12" rx="6" fill="#f3e9d8"/><circle cx="{x+70}" cy="{y}" r="9" fill="#f3e9d8"/></g>'
    s += '</g><g filter="url(#s)"><rect x="470" y="190" width="40" height="150" rx="6" fill="#58b84a" transform="rotate(8 470 190)"/><rect x="520" y="200" width="30" height="130" rx="6" fill="#f4a43a"/></g>'
    return s

def presa_pollo(): 
    s = plato(); s += '<g filter="url(#s)">'
    for i,(x,y,r) in enumerate(((220,240,-18),(310,225,6),(395,242,22))):
        s += f'<g transform="rotate({r} {x} {y})"><path d="M{x-60} {y} Q{x-60} {y-48} {x} {y-48} Q{x+64} {y-48} {x+64} {y} Q{x+64} {y+34} {x} {y+34} Q{x-60} {y+34} {x-60} {y}Z" fill="#cf8a2c"/><path d="M{x-40} {y-18} q30 -22 70 -4" stroke="#f3b95a" stroke-width="10" fill="none" stroke-linecap="round" opacity=".7"/><rect x="{x+54}" y="{y-8}" width="34" height="14" rx="7" fill="#f3e9d8"/></g>'
    s += '</g>'; return s

def vaso(color, tapa="#fff", pajilla="#d6322b", espuma=False, hielo=True):
    s = '<g filter="url(#s)">'
    s += f'<path d="M225 120 L375 120 L352 385 Q300 400 248 385 Z" fill="#fff" opacity=".35"/>'
    s += f'<path d="M232 165 L368 165 L352 385 Q300 400 248 385 Z" fill="{color}"/>'
    if espuma: s += '<path d="M228 130 Q300 80 372 130 L368 172 L232 172Z" fill="#fff6e0"/>'
    if hielo:
        for x,y,a in ((265,215,12),(318,250,-14),(285,300,8),(335,325,-8)): s += f'<rect x="{x}" y="{y}" width="34" height="34" rx="8" fill="#fff" opacity=".35" transform="rotate({a} {x} {y})"/>'
    s += f'<rect x="318" y="40" width="12" height="150" rx="5" fill="{pajilla}" transform="rotate(10 318 190)"/>'
    s += '<path d="M244 180 Q250 300 262 372" stroke="#fff" stroke-width="9" fill="none" opacity=".35" stroke-linecap="round"/></g>'
    return s

def botella(color, etiqueta="#fff"):
    s = '<g filter="url(#s)">'
    s += f'<rect x="274" y="60" width="52" height="56" rx="10" fill="{color}"/><rect x="268" y="48" width="64" height="20" rx="8" fill="#d6322b"/>'
    s += f'<path d="M274 112 Q214 150 214 210 L214 370 Q214 392 236 392 L364 392 Q386 392 386 370 L386 210 Q386 150 326 112Z" fill="{color}"/>'
    s += f'<rect x="214" y="236" width="172" height="86" fill="{etiqueta}" opacity=".92"/><circle cx="300" cy="279" r="26" fill="{color}" opacity=".9"/>'
    s += '<path d="M236 196 Q232 260 238 352" stroke="#fff" stroke-width="10" fill="none" opacity=".3" stroke-linecap="round"/></g>'
    return s

def postre(base="#f4d8b0", crema="#fff", topping="#c4372d", tipo="copa"):
    s = '<g filter="url(#s)">'
    if tipo == "copa":
        s += '<path d="M200 190 L400 190 L360 300 Q300 322 240 300 Z" fill="#fff" opacity=".4"/>'
        s += f'<path d="M212 200 L388 200 L352 292 Q300 312 248 292Z" fill="{base}"/><path d="M220 236 L380 236 L368 262 L232 262Z" fill="{crema}"/>'
        s += f'<path d="M222 200 Q300 150 378 200 Q300 224 222 200Z" fill="{crema}"/><circle cx="300" cy="168" r="22" fill="{topping}"/><path d="M300 150 q8 -16 22 -18" stroke="#3a9d3a" stroke-width="6" fill="none"/>'
        s += '<rect x="288" y="306" width="24" height="60" fill="#fff" opacity=".5"/><ellipse cx="300" cy="372" rx="70" ry="12" fill="#fff" opacity=".5"/>'
    elif tipo == "torta":
        s += f'<path d="M170 250 L430 250 L430 330 Q300 350 170 330Z" fill="{base}"/><path d="M170 250 Q300 200 430 250 Q300 280 170 250Z" fill="{crema}"/>'
        s += f'<rect x="170" y="290" width="260" height="12" fill="{crema}" opacity=".85"/><circle cx="300" cy="226" r="22" fill="{topping}"/>'
        for x in (220, 380): s += f'<circle cx="{x}" cy="240" r="12" fill="{topping}"/>'
    elif tipo == "helado":
        s += '<path d="M240 250 L360 250 L300 420 Z" fill="#d9a15c"/><path d="M252 270 L348 270 M264 300 L336 300 M276 335 L324 335" stroke="#b97a38" stroke-width="4"/>'
        for x,y,c in ((260,230,base),(340,230,crema),(300,180,topping)): s += f'<circle cx="{x}" cy="{y}" r="52" fill="{c}"/><ellipse cx="{x-14}" cy="{y-18}" rx="16" ry="8" fill="#fff" opacity=".35"/>'
    s += '</g>'
    return s

def combo(): return hamburguesa(1, ("queso","lechuga","tomate")).replace('cx="300" cy="300"','cx="260" cy="320"') + '<g transform="translate(300 110) scale(.7)">' + papas_cesta() + '</g>'

def vasito_sal(): return papas_cesta("#f2b93e")

FONDOS = {
    "hamburguesa": ("#f6a04a", "#c2411f"), "salchipapa": ("#ffd36b", "#e0782a"), "perro": ("#ff9f6a", "#c93a2a"),
    "pizza": ("#ff8f5a", "#a8321f"), "pollo": ("#ffb347", "#b8541a"), "papas": ("#ffd64d", "#d9852a"),
    "bebida_cola": ("#7e4a35", "#2b1810"), "bebida_naranja": ("#ffb44d", "#e2701c"), "bebida_fresa": ("#ff8fa3", "#c43a63"),
    "bebida_verde": ("#9bdc7a", "#3e8f3a"), "bebida_cafe": ("#c89a6b", "#5b3a22"), "bebida_agua": ("#8fd3f4", "#3a7fc4"),
    "postre": ("#ffb3c7", "#b8467a"), "helado": ("#bce4ff", "#6a7fd1"),
}
def f(k): return FONDOS[k]

# nombre_imagen -> (fondo, cuerpo)
IMAGENES = {}
def reg(nombre, fondo, cuerpo): IMAGENES[nombre] = marco(*f(fondo), cuerpo)

reg("hamburguesa-clasica", "hamburguesa", hamburguesa(1, ("lechuga","tomate","cebolla")))
reg("hamburguesa-queso", "hamburguesa", hamburguesa(1, ("queso","lechuga","tomate")))
reg("hamburguesa-doble", "hamburguesa", hamburguesa(2, ("queso","lechuga","tomate")))
reg("hamburguesa-tocineta", "hamburguesa", hamburguesa(1, ("queso","tocineta","lechuga","tomate")))
reg("hamburguesa-bbq", "hamburguesa", hamburguesa(1, ("queso","tocineta","cebolla","bbq"), pan="#c9803a"))
reg("hamburguesa-pollo", "hamburguesa", hamburguesa(1, ("lechuga","tomate","queso"), pollo=True))
reg("hamburguesa-huevo", "hamburguesa", hamburguesa(1, ("queso","huevo","lechuga","tomate")))
reg("hamburguesa-triple", "hamburguesa", hamburguesa(3, ("queso","tocineta","lechuga"), pan="#c9803a"))
reg("hamburguesa-hawaiana", "hamburguesa", hamburguesa(1, ("queso","pina","tocineta")))
reg("hamburguesa-veggie", "hamburguesa", hamburguesa(1, ("lechuga","tomate","cebolla"), carne="#4d6b2f"))
reg("salchipapa-clasica", "salchipapa", salchipapa("clasica"))
reg("salchipapa-mixta", "salchipapa", salchipapa("mixta"))
reg("salchipapa-criolla", "salchipapa", salchipapa("criolla"))
reg("salchipapa-picante", "salchipapa", salchipapa("picante"))
reg("salchipapa-simple", "salchipapa", salchipapa("simple"))
reg("perro-clasico", "perro", perro("clasico"))
reg("perro-suizo", "perro", perro("suizo"))
reg("perro-americano", "perro", perro("americano"))
reg("perro-tropical", "perro", perro("tropical"))
reg("perro-picante", "perro", perro("picante"))
for k in ("pepperoni","hawaiana","champinones","vegetariana","cuatro_quesos","carnes","pollo_bbq","margarita","criolla"):
    reg("pizza-" + k.replace("_","-"), "pizza", pizza(k))
reg("alitas-bbq", "pollo", alitas("#a8321f"))
reg("alitas-picantes", "pollo", alitas("#d63a1c"))
reg("alitas-miel", "pollo", alitas("#d9902a"))
reg("pollo-presas", "pollo", presa_pollo())
reg("papas-fritas", "papas", papas_cesta())
reg("papas-gajo", "papas", papas_cesta("#e0a53a"))
reg("combo-hamburguesa", "hamburguesa", combo())
reg("gaseosa-cola", "bebida_cola", vaso("#4a2415"))
reg("gaseosa-naranja", "bebida_naranja", vaso("#ff8a1c", pajilla="#fff"))
reg("jugo-fresa", "bebida_fresa", vaso("#e8456b", hielo=False))
reg("jugo-mora", "bebida_fresa", vaso("#7a2d62", pajilla="#fff", hielo=False))
reg("limonada", "bebida_verde", vaso("#d7e96c", pajilla="#d6322b"))
reg("limonada-cerezada", "bebida_fresa", vaso("#e04a6a", pajilla="#fff"))
reg("malteada", "bebida_cafe", vaso("#f0d9c0", espuma=True, hielo=False, pajilla="#3a7fc4"))
reg("malteada-fresa", "bebida_fresa", vaso("#f7a8bd", espuma=True, hielo=False, pajilla="#fff"))
reg("cafe-helado", "bebida_cafe", vaso("#8a5a35", espuma=True, pajilla="#222"))
reg("botella-agua", "bebida_agua", botella("#bfe6fa"))
reg("botella-te", "bebida_naranja", botella("#e0a030"))
reg("botella-gaseosa", "bebida_cola", botella("#3a1c10", "#d6322b"))
reg("postre-brownie", "postre", postre("#5a2e1b", "#f5e6d0", "#d6322b", "torta"))
reg("postre-cheesecake", "postre", postre("#f4d8b0", "#fff3d6", "#c4372d", "torta"))
reg("postre-copa-fresa", "postre", postre("#f7a8bd", "#fff", "#c4372d", "copa"))
reg("postre-copa-oreo", "postre", postre("#4a3a38", "#fff", "#2b1810", "copa"))
reg("helado-vainilla", "helado", postre("#fff1c2", "#f7a8bd", "#6a3b24", "helado"))

# ----------------------------------------------------------------- catálogo
# (categoria, nombre, descripcion, precio, imagen, etiqueta, filtros)
HAM = "Hamburguesas"; SAL = "Salchipapas"; PER = "Perros calientes"; PIZ = "Pizzas"; POL = "Pollo y alitas"
ACO = "Acompañantes"; BEB = "Bebidas"; POS = "Postres"; COM = "Combos"

P = []
def add(cat, nombre, desc, precio, img, etiqueta="", filtros=(), grupos=None, costo=0.42):
    P.append(dict(slug=None, categoria=cat, nombre=nombre, descripcion=desc, precio=precio, costo=round(precio*costo/100)*100,
                  imagen=img, etiqueta=etiqueta, filtros=list(filtros), grupos=grupos or []))

ADIC_HAM = {"nombre":"Adiciones","minimo":0,"maximo":4,"opciones":[("Queso extra",2000),("Tocineta",3000),("Huevo",2000),("Carne extra",6000),("Papas a la francesa",5000)]}
ADIC_SAL = {"nombre":"Adiciones","minimo":0,"maximo":4,"opciones":[("Queso extra",2500),("Huevo de codorniz",2000),("Tocineta",3000),("Chorizo extra",3500),("Maíz tierno",1500)]}
ADIC_PER = {"nombre":"Adiciones","minimo":0,"maximo":3,"opciones":[("Queso extra",2000),("Tocineta",3000),("Papa ripio extra",1000),("Salchicha extra",3500)]}
SALSAS = {"nombre":"Salsas","minimo":0,"maximo":3,"opciones":[("Rosada",0),("Piña",0),("Tártara",0),("BBQ",0),("Ají",0),("Mayonesa",0)]}
def tam(*precios): return {"nombre":"Tamaño","minimo":1,"maximo":1,"opciones":[(n,p) for n,p in precios]}
TAM_PIZZA = tam(("Personal (4 porciones)",0),("Mediana (6 porciones)",14000),("Grande (8 porciones)",26000),("Familiar (12 porciones)",42000))
BORDE = {"nombre":"Borde","minimo":0,"maximo":1,"opciones":[("Borde de queso",5000),("Borde de bocadillo",4000)]}

add(HAM,"Hamburguesa clásica","Carne de res 120 g, lechuga, tomate, cebolla y salsa de la casa en pan artesanal.",14000,"hamburguesa-clasica","Clásica",["popular","carne"],[ADIC_HAM,SALSAS])
add(HAM,"Hamburguesa con queso","Carne de res, doble queso derretido, lechuga y tomate.",16000,"hamburguesa-queso","",["carne","queso"],[ADIC_HAM,SALSAS])
add(HAM,"Hamburguesa doble carne","Dos carnes de 120 g, queso cheddar, lechuga y tomate.",22000,"hamburguesa-doble","Más vendida",["popular","carne","para-hambrientos"],[ADIC_HAM,SALSAS])
add(HAM,"Hamburguesa con tocineta","Carne, queso, tocineta crocante, lechuga y tomate.",20000,"hamburguesa-tocineta","",["carne","queso","tocineta"],[ADIC_HAM,SALSAS])
add(HAM,"Hamburguesa BBQ","Carne, tocineta, aros de cebolla, queso y salsa BBQ ahumada.",21000,"hamburguesa-bbq","Nueva",["carne","tocineta","dulce-ahumado"],[ADIC_HAM,SALSAS])
add(HAM,"Hamburguesa de pollo","Pechuga apanada crocante, queso, lechuga y salsa tártara.",17000,"hamburguesa-pollo","",["pollo"],[ADIC_HAM,SALSAS])
add(HAM,"Hamburguesa con huevo","Carne, huevo frito, queso, lechuga y tomate.",19000,"hamburguesa-huevo","",["carne","huevo"],[ADIC_HAM,SALSAS])
add(HAM,"Hamburguesa hawaiana","Carne, jamón, piña calada, queso y salsa de piña.",20000,"hamburguesa-hawaiana","",["carne","dulce-ahumado"],[ADIC_HAM,SALSAS])
add(HAM,"Hamburguesa triple","Tres carnes, triple queso, tocineta y salsa de la casa. Solo para valientes.",30000,"hamburguesa-triple","Brutal",["carne","tocineta","para-hambrientos"],[ADIC_HAM,SALSAS])
add(HAM,"Hamburguesa vegetariana","Medallón de lentejas y vegetales, queso, lechuga y tomate.",16000,"hamburguesa-veggie","Vegetariana",["vegetariano"],[ADIC_HAM,SALSAS])
add(HAM,"Hamburguesa infantil","Carne pequeña con queso y papas. Ideal para los niños.",11000,"hamburguesa-clasica","Kids",["infantil"],[SALSAS])

add(SAL,"Salchipapa sencilla","Papas a la francesa con salchicha, salsas y queso rallado.",10000,"salchipapa-simple","Económica",["economico"],[ADIC_SAL,SALSAS])
add(SAL,"Salchipapa clásica","Papas, salchicha, queso gratinado y salsas de la casa.",14000,"salchipapa-clasica","Clásica",["popular","queso"],[ADIC_SAL,SALSAS])
add(SAL,"Salchipapa mixta","Papas, salchicha, pollo desmechado, queso gratinado y maíz.",18000,"salchipapa-mixta","Más vendida",["popular","pollo","queso"],[ADIC_SAL,SALSAS])
add(SAL,"Salchipapa criolla","Papas, salchicha, chorizo, huevo de codorniz, queso y ají.",20000,"salchipapa-criolla","",["queso","huevo"],[ADIC_SAL,SALSAS])
add(SAL,"Salchipapa picante","Papas, salchicha, jalapeños, queso y salsa picante.",16000,"salchipapa-picante","Picante",["picante","queso"],[ADIC_SAL,SALSAS])
add(SAL,"Salchipapa doble queso","Doble capa de queso fundido sobre papas y salchicha.",17000,"salchipapa-clasica","",["queso"],[ADIC_SAL,SALSAS])
add(SAL,"Salchipapa para compartir","Papas XL, 3 salchichas, pollo, queso y salsas. Para 3 personas.",34000,"salchipapa-mixta","Para compartir",["para-compartir","pollo","queso"],[ADIC_SAL,SALSAS])
add(SAL,"Salchipapa con tocineta","Papas, salchicha, tocineta crocante, queso y salsa BBQ.",19000,"salchipapa-clasica","",["tocineta","queso"],[ADIC_SAL,SALSAS])

add(PER,"Perro clásico","Salchicha, papa ripio, queso rallado y salsas.",9000,"perro-clasico","Clásico",["economico"],[ADIC_PER,SALSAS])
add(PER,"Perro suizo","Salchicha suiza gratinada con queso, papa ripio y salsas.",12000,"perro-suizo","",["queso","popular"],[ADIC_PER,SALSAS])
add(PER,"Perro americano","Salchicha, tocineta, queso, cebolla crocante y salsa de mostaza.",13000,"perro-americano","",["tocineta"],[ADIC_PER,SALSAS])
add(PER,"Perro tropical","Salchicha, piña, queso gratinado, tocineta y salsa de piña.",13500,"perro-tropical","",["dulce-ahumado","queso"],[ADIC_PER,SALSAS])
add(PER,"Perro mexicano","Salchicha, jalapeños, queso gratinado, guacamole y ají.",14000,"perro-picante","Picante",["picante","queso"],[ADIC_PER,SALSAS])
add(PER,"Perro con pollo","Salchicha y pollo desmechado con queso gratinado y papa ripio.",14500,"perro-suizo","",["pollo","queso"],[ADIC_PER,SALSAS])
add(PER,"Perro gigante","Salchicha jumbo de 25 cm con todos los toppings.",16000,"perro-americano","Jumbo",["para-hambrientos"],[ADIC_PER,SALSAS])

sab = [("Pepperoni","Mozzarella y abundante pepperoni.",32000,"pizza-pepperoni","Más vendida",["popular","carne"]),
       ("Hawaiana","Jamón, piña calada y mozzarella.",30000,"pizza-hawaiana","",["dulce-ahumado"]),
       ("Champiñones","Champiñones frescos, mozzarella y orégano.",30000,"pizza-champinones","",["vegetariano"]),
       ("Vegetariana","Pimentón, cebolla, maíz, aceitunas y champiñones.",29000,"pizza-vegetariana","Vegetariana",["vegetariano"]),
       ("Cuatro quesos","Mozzarella, cheddar, parmesano y queso azul.",35000,"pizza-cuatro-quesos","Gourmet",["queso"]),
       ("Carnes","Jamón, pepperoni, salchicha, tocineta y carne molida.",36000,"pizza-carnes","Contundente",["carne","para-hambrientos"]),
       ("Pollo BBQ","Pollo desmechado, cebolla y salsa BBQ.",33000,"pizza-pollo-bbq","",["pollo","dulce-ahumado"]),
       ("Margarita","Salsa de tomate, mozzarella fresca y albahaca.",27000,"pizza-margarita","Clásica",["vegetariano","economico"]),
       ("Criolla","Chorizo, cebolla, pimentón y queso costeño.",34000,"pizza-criolla","",["picante"]),
       ("Mixta","Jamón, pollo, champiñones y mozzarella.",34000,"pizza-carnes","",["pollo","popular"])]
for n,d,pr,im,et,fi in sab:
    add(PIZ,"Pizza "+n,d,pr,im,et,fi,[TAM_PIZZA,BORDE],costo=0.38)

add(POL,"Alitas BBQ x8","Ocho alitas bañadas en salsa BBQ ahumada con papas.",24000,"alitas-bbq","Popular",["popular","dulce-ahumado","para-compartir"],[tam(("8 unidades",0),("12 unidades",8000),("16 unidades",15000))])
add(POL,"Alitas picantes x8","Ocho alitas con salsa búfalo extra picante.",24000,"alitas-picantes","Picante",["picante"],[tam(("8 unidades",0),("12 unidades",8000),("16 unidades",15000))])
add(POL,"Alitas miel mostaza x8","Ocho alitas glaseadas en miel y mostaza.",24000,"alitas-miel","",["dulce-ahumado"],[tam(("8 unidades",0),("12 unidades",8000),("16 unidades",15000))])
add(POL,"Pollo broaster 2 presas","Dos presas crocantes con papas y ensalada.",20000,"pollo-presas","",["pollo","popular"],[])
add(POL,"Pollo broaster 4 presas","Cuatro presas crocantes con papas y ensalada.",36000,"pollo-presas","Para compartir",["pollo","para-compartir"],[])
add(POL,"Nuggets x10","Diez nuggets de pollo con salsa a elección.",16000,"pollo-presas","",["infantil","pollo"],[SALSAS])

add(ACO,"Papas a la francesa","Porción de papas crocantes.",7000,"papas-fritas","",["vegetariano","economico"],[SALSAS])
add(ACO,"Papas en gajos","Gajos de papa sazonados con especias.",9000,"papas-gajo","",["vegetariano"],[SALSAS])
add(ACO,"Papas con queso y tocineta","Papas gratinadas con queso cheddar y tocineta.",15000,"papas-fritas","",["queso","tocineta"],[])
add(ACO,"Aros de cebolla","Aros apanados y dorados con salsa tártara.",9000,"papas-gajo","",["vegetariano"],[])
add(ACO,"Maíz desgranado gratinado","Maíz tierno con queso fundido.",12000,"papas-gajo","",["queso","vegetariano"],[])

add(COM,"Combo hamburguesa","Hamburguesa con queso + papas + gaseosa.",25000,"combo-hamburguesa","Ahorra",["combo","popular"],[],costo=0.45)
add(COM,"Combo perro","Perro suizo + papas + gaseosa.",20000,"combo-hamburguesa","Ahorra",["combo","economico"],[],costo=0.45)
add(COM,"Combo pizza personal","Pizza personal a elección + gaseosa.",28000,"pizza-pepperoni","Ahorra",["combo"],[],costo=0.42)
add(COM,"Combo pareja","2 hamburguesas, 1 papas grandes y 2 gaseosas.",52000,"combo-hamburguesa","Pareja",["combo","para-compartir"],[],costo=0.45)
add(COM,"Combo familiar","Pizza familiar, 8 alitas y gaseosa de 1.5 L.",89000,"pizza-pepperoni","Familiar",["combo","para-compartir"],[],costo=0.42)

add(BEB,"Gaseosa 400 ml","Cola, naranja o lima limón.",4000,"gaseosa-cola","",["economico"],[{"nombre":"Sabor","minimo":1,"maximo":1,"opciones":[("Cola",0),("Naranja",0),("Lima limón",0)]}],costo=0.55)
add(BEB,"Gaseosa 1.5 L","Para compartir en casa.",8500,"botella-gaseosa","",["para-compartir"],[{"nombre":"Sabor","minimo":1,"maximo":1,"opciones":[("Cola",0),("Naranja",0),("Lima limón",0)]}],costo=0.55)
add(BEB,"Limonada natural","Limón exprimido al momento.",5500,"limonada","",["natural","popular"],[],costo=0.3)
add(BEB,"Limonada cerezada","Limonada con granadina y cereza.",7000,"limonada-cerezada","",["natural"],[],costo=0.3)
add(BEB,"Jugo de fresa","En agua o en leche.",7000,"jugo-fresa","",["natural"],[{"nombre":"Preparado en","minimo":1,"maximo":1,"opciones":[("Agua",0),("Leche",1500)]}],costo=0.35)
add(BEB,"Jugo de mora","En agua o en leche.",7000,"jugo-mora","",["natural"],[{"nombre":"Preparado en","minimo":1,"maximo":1,"opciones":[("Agua",0),("Leche",1500)]}],costo=0.35)
add(BEB,"Malteada de chocolate","Helado de vainilla, chocolate y crema chantilly.",11000,"malteada","",["dulce","popular"],[],costo=0.4)
add(BEB,"Malteada de fresa","Helado de vainilla, fresa y crema chantilly.",11000,"malteada-fresa","",["dulce"],[],costo=0.4)
add(BEB,"Café helado","Café frío con leche y hielo.",7500,"cafe-helado","",["dulce"],[],costo=0.3)
add(BEB,"Té frío","Té de durazno o limón.",5000,"botella-te","",["economico"],[],costo=0.4)
add(BEB,"Agua 600 ml","Agua mineral.",3000,"botella-agua","",["economico"],[],costo=0.5)

add(POS,"Brownie con helado","Brownie tibio con bola de helado y salsa de chocolate.",12000,"postre-brownie","",["dulce","popular"],[],costo=0.35)
add(POS,"Cheesecake de fresa","Porción de cheesecake con salsa de fresa.",11000,"postre-cheesecake","",["dulce"],[],costo=0.35)
add(POS,"Copa de fresas con crema","Fresas frescas con crema chantilly.",10000,"postre-copa-fresa","",["dulce"],[],costo=0.35)
add(POS,"Copa oreo","Helado, galleta oreo triturada y chocolate.",11000,"postre-copa-oreo","",["dulce"],[],costo=0.35)
add(POS,"Helado de vainilla","Tres bolas con topping a elección.",9000,"helado-vainilla","",["dulce","economico"],[{"nombre":"Topping","minimo":0,"maximo":2,"opciones":[("Salsa de chocolate",0),("Salsa de fresa",0),("Chispas de colores",500),("Galleta triturada",1000)]}],costo=0.35)

def slugify(t):
    import unicodedata, re
    t = unicodedata.normalize("NFD", t); t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")

vistos = set()
for p in P:
    p["slug"] = slugify(p["nombre"])
    assert p["slug"] not in vistos, p["slug"]; vistos.add(p["slug"])
    assert p["imagen"] in IMAGENES, p["imagen"]
    p["grupos"] = [dict(nombre=g["nombre"], minimo=g["minimo"], maximo=g["maximo"],
                        opciones=[dict(nombre=n, precioExtra=x) for n, x in g["opciones"]]) for g in p["grupos"]]
    p["precio"] = int(p["precio"])
    # etiqueta de rango de precio (para filtrar)
usadas = {p["imagen"] for p in P}
ORDEN = [HAM, SAL, PER, PIZ, POL, COM, ACO, BEB, POS]
doc = {"version": 1, "categorias": [dict(nombre=c, orden=i) for i, c in enumerate(ORDEN)], "productos": P}

def a_texto(d):
    """Formato por líneas separadas por | (sin dependencias de JSON):
    C|categoria|orden  ·  P|slug|categoria|nombre|descripcion|precio|costo|imagen|etiqueta|filtros,separados
    G|grupo|minimo|maximo (del producto anterior)  ·  O|opcion|precioExtra (del grupo anterior)"""
    L = ["# Biblioteca de productos precargados. Generado por herramientas/generar-biblioteca.py; no editar a mano."]
    for c in d["categorias"]: L.append(f"C|{c['nombre']}|{c['orden']}")
    for p in d["productos"]:
        for campo in (p["nombre"], p["descripcion"], p["etiqueta"]): assert "|" not in campo
        L.append("|".join(["P", p["slug"], p["categoria"], p["nombre"], p["descripcion"], str(p["precio"]), str(p["costo"]), p["imagen"], p["etiqueta"], ",".join(p["filtros"])]))
        for g in p["grupos"]:
            L.append(f"G|{g['nombre']}|{g['minimo']}|{g['maximo']}")
            for o in g["opciones"]: L.append(f"O|{o['nombre']}|{o['precioExtra']}")
    return "\n".join(L) + "\n"

if __name__ == "__main__":
    SALIDA.mkdir(parents=True, exist_ok=True); IMG.mkdir(parents=True, exist_ok=True)
    for f_ in IMG.glob("*"): f_.unlink()
    (SALIDA / "catalogo.txt").write_text(a_texto(doc), encoding="utf-8")
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = pw.chromium.launch(); pg = b.new_page(viewport={"width": 600, "height": 450})
        for nombre in sorted(usadas):
            pg.set_content(f'<body style="margin:0">{IMAGENES[nombre]}</body>')
            pg.screenshot(path=str(IMG / f"{nombre}.png"), clip={"x":0,"y":0,"width":600,"height":450})
        b.close()
    print(len(P), "productos,", len(usadas), "imágenes")
