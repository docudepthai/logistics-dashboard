"""
Atlas-1 Model Serving on Modal
Turkish Logistics AI Assistant
"""

import modal

# Create Modal app
app = modal.App("atlas-logistics")

# Create a volume to store the model
model_volume = modal.Volume.from_name("atlas-model-vol")

# Docker image with vLLM and dependencies
vllm_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "vllm>=0.6.0",
        "transformers",
        "torch",
        "huggingface_hub",
    )
)


@app.function(
    image=vllm_image,
    gpu="A10G",  # 24GB GPU, good for 7B model
    volumes={"/model": model_volume},
    timeout=600,
    container_idle_timeout=300,  # Shut down after 5 min idle (saves money)
)
def upload_model(model_path: str):
    """Upload model from local machine to Modal volume."""
    import shutil
    import os

    # Copy model to volume
    dest = "/model/atlas-1"
    if os.path.exists(dest):
        shutil.rmtree(dest)
    shutil.copytree(model_path, dest)

    # Commit the volume
    model_volume.commit()

    print(f"Model uploaded to {dest}")
    return dest


@app.cls(
    image=vllm_image,
    gpu="A10G",
    volumes={"/model": model_volume},
    container_idle_timeout=300,  # Auto-shutdown after 5 min idle
    allow_concurrent_inputs=10,
    keep_warm=0,  # Scale to zero when idle (save money)
)
class AtlasModel:
    """Serverless Atlas model inference."""

    @modal.enter()
    def load_model(self):
        """Load model when container starts."""
        from vllm import LLM, SamplingParams
        from vllm.lora.request import LoRARequest
        import os

        # Check if we have atlas-1.4 adapter (LoRA) or fallback
        adapter_path = "/model/atlas-1.4-adapter"
        merged_path = "/model/atlas-1"

        if os.path.exists(adapter_path):
            # Load base Qwen + LoRA adapter
            print("Loading Qwen base + atlas-1.4 LoRA adapter...")
            self.llm = LLM(
                model="Qwen/Qwen2.5-7B-Instruct",
                trust_remote_code=True,
                max_model_len=4096,
                gpu_memory_utilization=0.9,
                enable_lora=True,
                max_lora_rank=16,
            )
            self.lora_request = LoRARequest("atlas-1.4", 1, adapter_path)
            print("Atlas-1.4 (LoRA) loaded!")
        else:
            # Fallback to merged model
            print("Loading merged atlas-1 model...")
            self.llm = LLM(
                model=merged_path,
                trust_remote_code=True,
                max_model_len=4096,
                gpu_memory_utilization=0.9,
            )
            self.lora_request = None
            print("Atlas-1 (merged) loaded!")

        self.sampling_params = SamplingParams(
            temperature=0.7,
            max_tokens=512,
            top_p=0.9,
        )

    def _generate(self, messages: list[dict]) -> str:
        """Generate response from messages (internal)."""
        # Format messages for Qwen
        prompt = self._format_messages(messages)

        if self.lora_request:
            outputs = self.llm.generate([prompt], self.sampling_params, lora_request=self.lora_request)
        else:
            outputs = self.llm.generate([prompt], self.sampling_params)
        response = outputs[0].outputs[0].text

        return response.strip()

    @modal.method()
    def generate(self, messages: list[dict]) -> str:
        """Generate response from messages (remote callable)."""
        return self._generate(messages)

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

        # Add assistant start token for generation
        formatted += "<|im_start|>assistant\n"
        return formatted

    @modal.web_endpoint(method="POST")
    def chat(self, request: dict) -> dict:
        """HTTP endpoint for chat completions (OpenAI-compatible)."""
        messages = request.get("messages", [])

        if not messages:
            return {"error": "No messages provided"}

        response = self._generate(messages)

        return {
            "id": "atlas-1",
            "object": "chat.completion",
            "model": "atlas-1",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response
                },
                "finish_reason": "stop"
            }]
        }

    @modal.web_endpoint(method="POST")
    def parse_intent(self, request: dict) -> dict:
        """Parse user intent and extract origin/destination from natural language."""
        import json
        import re

        user_message = request.get("message", "")
        conversation_history = request.get("history", [])

        if not user_message:
            return {"error": "No message provided"}

        # System prompt for intent extraction
        system_prompt = """Sen Patron yük asistanısın. Mesajı analiz et ve JSON döndür.

INTENT TİPLERİ:
- search = yük arıyor (şehir adı var)
- pagination = devam, daha fazla, sonraki
- intra_city = şehir içi (istanbul içi)
- greeting = merhaba, selam, sa, günaydın
- goodbye = görüşürüz, bye, hoşçakal, bb, hadi eyvallah
- thanks = teşekkürler, sağol, eyvallah, tamam teşekkür
- bot_identity = sen kimsin, bot musun, gerçek mi
- help = nasıl kullanılır, yardım, örnek
- pricing = ücretli mi, kaç para, fiyat
- subscription = premium, abone, üyelik
- support = destek, şikayet, sorun var
- phone_question = telefon neden yok, numara
- load_price = navlun, yük fiyatı neden yok
- freshness = ne zaman güncelleniyor, taze mi
- vehicle_info = bende tır var, kamyonum var
- location_info = istanbul'dayım, buradayım
- feedback_positive = güzel, süper, işe yarıyor
- feedback_negative = kötü, berbat, işe yaramıyor
- confirmation = tamam, evet, ok
- negation = hayır, istemiyorum
- abuse = küfür, hakaret (orospu, piç, siktir)
- spam = bot mesajı, "bunun hakkında daha fazla bilgi"
- international = yurtdışı (irak, iran, avrupa, bulgaristan, gürcistan, rusya, polonya)
- other = alakasız (kız arkadaş, hava durumu, vs)

KONUM KURALLARI:
- "X'e gitmek istiyorum, Y'deyim" → origin:Y, destination:X
- "X'den Y'ye" → origin:X, destination:Y
- "X Y" (iki şehir) → origin:X, destination:Y
- "X içi" → origin:X, destination:X, intent:intra_city

SADECE JSON, başka bir şey yazma:
{"intent":"...","origin":null,"destination":null,"vehicle_type":null,"cargo_type":null}"""

        messages = [{"role": "system", "content": system_prompt}]

        # Add conversation history for context
        for msg in conversation_history[-4:]:  # Last 4 messages for context
            messages.append(msg)

        messages.append({"role": "user", "content": user_message})

        # Generate with low temperature for consistent JSON
        from vllm import SamplingParams
        prompt = self._format_messages(messages)

        json_params = SamplingParams(
            temperature=0.1,  # Low temperature for consistent output
            max_tokens=150,
            top_p=0.9,
        )

        if self.lora_request:
            outputs = self.llm.generate([prompt], json_params, lora_request=self.lora_request)
        else:
            outputs = self.llm.generate([prompt], json_params)
        response = outputs[0].outputs[0].text.strip()

        # Try to parse JSON from response
        try:
            # Find JSON in response (in case model adds extra text)
            json_match = re.search(r'\{[^}]+\}', response)
            if json_match:
                parsed = json.loads(json_match.group())
                return {
                    "success": True,
                    "origin": parsed.get("origin"),
                    "destination": parsed.get("destination"),
                    "intent": parsed.get("intent", "search"),
                    "vehicle_type": parsed.get("vehicle_type"),
                    "cargo_type": parsed.get("cargo_type"),
                    "raw_response": response
                }
        except json.JSONDecodeError:
            pass

        # Fallback if JSON parsing fails
        return {
            "success": False,
            "origin": None,
            "destination": None,
            "intent": "other",
            "vehicle_type": None,
            "cargo_type": None,
            "raw_response": response
        }


@app.local_entrypoint()
def main():
    """Test the model locally."""
    model = AtlasModel()

    test_messages = [
        {"role": "system", "content": "Sen AnkaGo'nun Türk kamyon şoförleri için yük bulma asistanısın."},
        {"role": "user", "content": "istanbul ankara"}
    ]

    print("Testing Atlas-1...")
    response = model.generate.remote(test_messages)
    print(f"Response: {response}")


if __name__ == "__main__":
    main()
