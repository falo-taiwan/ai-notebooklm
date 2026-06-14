#!/usr/bin/env python3
import asyncio
import sys
import os
import json
import argparse
from pathlib import Path

# Add research/gemini-webapi/src to path
PROJECT_ROOT = Path(__file__).parent.resolve()
sys.path.append(str(PROJECT_ROOT / "research" / "gemini-webapi" / "src"))

from gemini_webapi import GeminiClient

def extract_google_cookies():
    # Attempt to locate storage_state.json
    candidates = [
        PROJECT_ROOT / "config" / "storage_state.json",
        Path("~/.notebooklm/profiles/default/storage_state.json").expanduser(),
    ]
    storage_path = next((p for p in candidates if p.exists()), None)
    if not storage_path:
        raise FileNotFoundError("Could not find storage_state.json in any standard locations.")

    with open(storage_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    cookies = data.get("cookies", [])
    secure_1psid = None
    secure_1psidts = None
    for cookie in cookies:
        if cookie.get("name") == "__Secure-1PSID":
            secure_1psid = cookie.get("value")
        elif cookie.get("name") == "__Secure-1PSIDTS":
            secure_1psidts = cookie.get("value")
    return secure_1psid, secure_1psidts

async def run_gemini(question, metadata_json=None, model_name=None, thinking_level=None):
    try:
        # Extract cookies from storage_state.json
        secure_1psid, secure_1psidts = extract_google_cookies()
        if not secure_1psid:
            raise ValueError("__Secure-1PSID cookie not found in storage_state.json")

        # Initialize the GeminiClient
        client = GeminiClient(secure_1psid=secure_1psid, secure_1psidts=secure_1psidts)
        await client.init()

        metadata = None
        if metadata_json:
            try:
                metadata = json.loads(metadata_json)
            except Exception:
                pass

        # Resolve model argument dynamically based on model and thinking level selection
        model_arg = None
        model_name = (model_name or "flash").strip().lower()
        thinking_level = (thinking_level or "standard").strip().lower()

        if model_name == "flash-lite":
            capacity_tail = 4 if thinking_level == "extended" else 1
            model_arg = {
                "model_name": f"flash-lite-{thinking_level}",
                "model_header": {
                    "x-goog-ext-525001261-jspb": f'[1,null,null,null,"8c46e95b1a07cecc",null,null,0,[4],null,null,{capacity_tail}]',
                    "x-goog-ext-73010989-jspb": "[0]",
                    "x-goog-ext-73010990-jspb": "[0]"
                }
            }
        elif model_name == "pro":
            if thinking_level == "deep":
                model_arg = "gemini-3-pro-advanced"
            elif thinking_level == "extended":
                model_arg = "gemini-3-pro-plus"
            else:
                model_arg = "gemini-3-pro"
        else: # default to 3.5 flash
            if thinking_level == "extended":
                model_arg = "gemini-3-flash-plus"
            else:
                model_arg = "gemini-3-flash"

        kwargs = {}
        if metadata and isinstance(metadata, list) and len(metadata) > 0:
            kwargs["metadata"] = metadata
        if model_arg:
            kwargs["model"] = model_arg

        # Start or continue chat session
        chat_session = client.start_chat(**kwargs)
        response = await chat_session.send_message(question)

        output = {
            "ok": True,
            "answer": response.text,
            "metadata": response.metadata
        }
        await client.close()
        return output

    except Exception as e:
        return {
            "ok": False,
            "error": str(e)
        }

def main():
    parser = argparse.ArgumentParser(description="Gemini Web API Helper")
    parser.add_argument("-q", "--question", required=True, help="Question to ask Gemini")
    parser.add_argument("-m", "--metadata", default=None, help="JSON-encoded metadata array [cid, rid, rcid]")
    parser.add_argument("--model", default=None, help="Gemini model name (flash, pro, flash-lite)")
    parser.add_argument("--thinking", default=None, help="Gemini thinking mode (standard, extended, deep)")
    args = parser.parse_args()

    result = asyncio.run(run_gemini(args.question, args.metadata, args.model, args.thinking))
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
