"""
Direct upload to Modal Volume using modal volume put
"""
import modal
import subprocess
import os

# Create volume
vol = modal.Volume.from_name("atlas-model-vol", create_if_missing=True)

MODEL_PATH = os.path.expanduser("~/Downloads/atlas-1-model")

if __name__ == "__main__":
    print("Uploading model to Modal volume...")
    print(f"Source: {MODEL_PATH}")

    # Use modal CLI to upload
    cmd = [
        "/Users/caglarbinici/Library/Python/3.9/bin/modal",
        "volume", "put",
        "atlas-model-vol",
        MODEL_PATH,
        "/atlas-1",
        "--force"
    ]

    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=False)

    if result.returncode == 0:
        print("\n✅ Upload complete!")
    else:
        print(f"\n❌ Upload failed with code {result.returncode}")
