filepath = r"C:\Users\אלי\smart-ads-ai-backup\app\routes\app._index.jsx"
with open(filepath, "r", encoding="utf-8", errors="surrogateescape") as f:
    content = f.read()
with open(filepath, "w", encoding="utf-8", errors="surrogatepass") as f:
    f.write(content)
print("Fixed encoding")
