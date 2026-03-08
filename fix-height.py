import re

path = r'app\routes\app.campaigns.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Change height:100% to min-height:100vh on main container
content = content.replace(
    """fontFamily:"'DM Sans',system-ui,sans-serif",height:"100%",display:"flex",flexDirection:"column""",
    """fontFamily:"'DM Sans',system-ui,sans-serif",minHeight:"100vh",height:"auto",display:"flex",flexDirection:"column\""""
)

# Fix 2: Change overflow:hidden to overflow:visible on grid, add minHeight
content = content.replace(
    'display:"grid",gridTemplateColumns:"280px 1fr",flex:1,overflow:"hidden"',
    'display:"grid",gridTemplateColumns:"280px 1fr",flex:1,minHeight:0,overflow:"auto"'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! Fixed height and overflow.")
