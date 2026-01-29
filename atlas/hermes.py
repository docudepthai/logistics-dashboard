"""
Hermes - WhatsApp Logistics Message Parser
Fine-tuned Qwen 2.5 7B for extracting structured job data from Turkish messages
"""

import modal

app = modal.App("hermes-parser")
model_volume = modal.Volume.from_name("atlas-model-vol")

vllm_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "vllm>=0.6.0",
        "transformers",
        "torch",
        "huggingface_hub",
    )
)

SYSTEM_PROMPT = """Sen Hermes, WhatsApp lojistik mesaj ayrıştırıcısısın.

Her mesajda BİRDEN FAZLA yük olabilir. Her yükü ayrı ayrı çıkar.

Her yük için:
- origin: Yükleme şehri/ilçesi
- destination: Teslim şehri/ilçesi
- weight: Tonaj (kg veya ton olarak)
- vehicle_type: TIR/KAMYON/KAMYONET
- body_type: ACIK/KAPALI/TENTELI/DAMPERLI
- phone: Telefon numarası

SADECE JSON array döndür. Başka açıklama yazma."""


@app.cls(
    image=vllm_image,
    gpu="A10G",
    volumes={"/model": model_volume},
    container_idle_timeout=300,
    allow_concurrent_inputs=10,
    timeout=600,  # 10 minute timeout for cold starts
)
class HermesModel:
    """Hermes parser inference."""

    @modal.enter()
    def load_model(self):
        """Load model when container starts."""
        from vllm import LLM, SamplingParams

        print("Loading Hermes-1 model...")
        self.llm = LLM(
            model="/model/hermes-1",
            trust_remote_code=True,
            max_model_len=4096,
            gpu_memory_utilization=0.9,
        )
        print("Hermes-1 loaded!")

        self.sampling_params = SamplingParams(
            temperature=0.1,  # Low temp for consistent JSON
            max_tokens=1024,
            top_p=0.9,
        )

    def _format_messages(self, messages: list[dict]) -> str:
        """Format messages in Qwen/ChatML format."""
        formatted = ""
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if role == "system":
                formatted += f"<|im_start|>system\n{content}<|im_end|>\n"
            elif role == "user":
                formatted += f"<|im_start|>user\n{content}<|im_end|>\n"
            elif role == "assistant":
                formatted += f"<|im_start|>assistant\n{content}<|im_end|>\n"

        formatted += "<|im_start|>assistant\n"
        return formatted

    def _parse_internal(self, raw_text: str) -> list[dict]:
        """Internal parse method - does the actual work."""
        import json
        import re

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": raw_text},
        ]

        prompt = self._format_messages(messages)
        outputs = self.llm.generate([prompt], self.sampling_params)
        response = outputs[0].outputs[0].text.strip()

        # Parse JSON from response
        try:
            # Find JSON array in response
            json_match = re.search(r'\[[\s\S]*\]', response)
            if json_match:
                return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

        return []

    @modal.method()
    def parse(self, raw_text: str) -> list[dict]:
        """Parse a WhatsApp message and extract jobs (remote callable)."""
        return self._parse_internal(raw_text)

    @modal.web_endpoint(method="POST")
    def parse_message(self, request: dict) -> dict:
        """HTTP endpoint for parsing messages."""
        raw_text = request.get("message", "")

        if not raw_text:
            return {"error": "No message provided", "jobs": []}

        jobs = self._parse_internal(raw_text)

        return {
            "success": True,
            "jobs": jobs,
            "count": len(jobs),
        }

    @modal.web_endpoint(method="POST")
    def parse_batch(self, request: dict) -> dict:
        """Parse multiple messages in batch."""
        messages = request.get("messages", [])

        if not messages:
            return {"error": "No messages provided", "results": []}

        results = []
        for msg in messages:
            jobs = self._parse_internal(msg)
            results.append({"message": msg, "jobs": jobs, "count": len(jobs)})

        return {
            "success": True,
            "results": results,
            "total_jobs": sum(r["count"] for r in results),
        }


@app.local_entrypoint()
def main():
    """Test Hermes locally."""
    model = HermesModel()

    test_message = """⭕Tekirdağ Çorlu--Ankara Kapalı TIR 15ton
⭕Hatay--İstanbul Tuzla Açık TIR
⭕Kayseri Kocasinan--Antalya Konyaaltı Kapalı/Tenteli Kamyonet 700kg

WhatsApp üzerinden benimle iletişim kurun.
  05015971849"""

    print("Testing Hermes-1...")
    result = model.parse.remote(test_message)
    print(f"Found {len(result)} jobs:")
    for job in result:
        print(f"  {job}")
