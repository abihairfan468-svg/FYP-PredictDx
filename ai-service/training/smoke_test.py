"""Calls the running AI service with unseen test images (original files, not the 224px copies)."""
import io, json, os, random, re, sys
import urllib.request
import numpy as np, pandas as pd
from PIL import Image

KEY = re.search(r'^AI_INTERNAL_KEY="?([^"\r\n]*)', open(r"C:\Users\clicks\Documents\FYP\PredictDX-UPDATED\PredictDX-Final-Year-Project--main\backend\.env").read(), re.M).group(1)
SRC = r"C:\Users\clicks\Documents\FYP\Balanced_dataset_clean"
FOLDER = {"adult_normal": "Normal", "child_pediatric": "Pediatric_", "child_pediatric_pneumonia": "Pediatric_Pneumonia",
          "adult_predictdx": r"PredictDX_Adult_Pneumonia\PredictDX_Adult_Pneumonia", "adult_tb": "TB"}


def original(rel):
    """data224 file name -> original file in Balanced_dataset_clean."""
    label, name = rel.split("/")
    stem = name[:-4]
    for prefix, folder in [("adult_normal_", "Normal"), ("child_pediatric_normal_", "Pediatric_Normal"),
                           ("child_pediatric_pneumonia_", "Pediatric_Pneumonia"), ("adult_predictdx_adult_pneumonia_", r"PredictDX_Adult_Pneumonia\PredictDX_Adult_Pneumonia"),
                           ("adult_tb_", "TB")]:
        if stem.startswith(prefix):
            base = stem[len(prefix):]
            d = os.path.join(SRC, folder)
            for f in os.listdir(d):
                if os.path.splitext(f)[0] == base:
                    return os.path.join(d, f)
    return os.path.join(r"D:\PredictDx-AI\data224", rel)


def call(name, data):
    boundary = "----pdx" + str(random.random())[2:]
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\nContent-Type: application/octet-stream\r\n\r\n").encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request("http://127.0.0.1:8000/analyse", body, {"Content-Type": f"multipart/form-data; boundary={boundary}", "X-Internal-Key": KEY})
    return json.loads(urllib.request.urlopen(req, timeout=120).read())


df = pd.read_csv(r"D:\PredictDx-AI\data224\split.csv")
test = df[df.split == "test"]
random.seed(int(sys.argv[1]) if len(sys.argv) > 1 else 5)
cases = []
for (label, source), g in test.groupby(["label", "source"]):
    for rel in g.sample(2, random_state=random.randint(0, 999)).file:
        cases.append((f"{label}/{source}", original(rel)))
cases.append(("project demo X-ray", r"C:\Users\clicks\Documents\FYP\PredictDX-UPDATED\PredictDX-Final-Year-Project--main\backend\prisma\demo-xray.jpg"))
noise = io.BytesIO(); Image.fromarray(np.random.default_rng(1).integers(0, 255, (400, 400, 3), dtype=np.uint8)).save(noise, "PNG")
for true, path in cases:
    r = call(os.path.basename(path), open(path, "rb").read())
    if r["isChestXray"]:
        print(f"{true:24s} -> {r['label']:13s} {r['confidence']:5.1f}%  band={r['assessment']['band']:10s} risk={r['risk']['riskBand']:6s} {r['inferenceMs']} ms")
    else:
        print(f"{true:24s} -> REJECTED (not a chest X-ray) notCXR={r['notCxrProbability']}% sim={r['gateSimilarity']}")
r = call("noise.png", noise.getvalue())
print(f"{'random noise':24s} -> {'REJECTED' if not r['isChestXray'] else r['label']}  notCXR={r['notCxrProbability']}% sim={r['gateSimilarity']}")
