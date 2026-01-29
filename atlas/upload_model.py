"""
Upload Atlas-1 model to Modal Volume
Run: python -m modal run atlas/upload_model.py --model-path /path/to/model
"""

import modal
import os

app = modal.App("atlas-upload")
model_volume = modal.Volume.from_name("atlas-model-volume", create_if_missing=True)

@app.function(
    volumes={"/model": model_volume},
    timeout=3600,  # 1 hour for large uploads
)
def upload_to_volume(local_files: list[tuple[str, bytes]]):
    """Upload files to the Modal volume."""
    import os

    dest_dir = "/model/atlas-1"
    os.makedirs(dest_dir, exist_ok=True)

    for filename, content in local_files:
        filepath = os.path.join(dest_dir, filename)
        # Create subdirectories if needed
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "wb") as f:
            f.write(content)
        print(f"Uploaded: {filename}")

    model_volume.commit()
    print(f"\nModel uploaded to {dest_dir}")


@app.local_entrypoint()
def main(model_path: str):
    """Upload model from local path to Modal."""
    import os

    print(f"Uploading model from: {model_path}")

    if not os.path.exists(model_path):
        print(f"Error: Path {model_path} does not exist")
        return

    # Collect all files
    files = []
    for root, dirs, filenames in os.walk(model_path):
        for filename in filenames:
            filepath = os.path.join(root, filename)
            relpath = os.path.relpath(filepath, model_path)

            # Read file content
            with open(filepath, "rb") as f:
                content = f.read()

            files.append((relpath, content))
            print(f"Queued: {relpath} ({len(content) / 1024 / 1024:.1f} MB)")

    print(f"\nUploading {len(files)} files...")

    # Upload in batches to avoid memory issues
    BATCH_SIZE = 5
    for i in range(0, len(files), BATCH_SIZE):
        batch = files[i:i + BATCH_SIZE]
        upload_to_volume.remote(batch)
        print(f"Batch {i // BATCH_SIZE + 1} uploaded")

    print("\nDone! Model is ready on Modal.")
