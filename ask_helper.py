#!/usr/bin/env python3
import asyncio
import sys
import json
import argparse
from notebooklm import NotebookLMClient
from notebooklm.exceptions import ChatError, NetworkError

async def run_ask(notebook_id, conversation_id, question):
    try:
        async with NotebookLMClient.from_storage() as client:
            effective_conv_id = None

            if conversation_id and conversation_id != "new":
                # We have an existing conversation ID. Fetch history from the server.
                effective_conv_id = conversation_id
                try:
                    qa_pairs = await client.chat.get_history(notebook_id, conversation_id=effective_conv_id)
                    # Manually populate the client's internal cache so that the history payload is sent to Google
                    for idx, (q, a) in enumerate(qa_pairs):
                        client.chat._cache.cache_conversation_turn(
                            conversation_id=effective_conv_id,
                            query=q,
                            answer=a,
                            turn_number=idx + 1
                        )
                except Exception as e:
                    # Non-fatal: if fetching history fails, log it and proceed without history
                    print(f"Warning: Failed to fetch history for conversation {effective_conv_id}: {e}", file=sys.stderr)

            # If it's a new conversation, we want to delete the previous active conversation on the client 
            # if we want to ensure we don't accidentally append to it. 
            # (NotebookLM default behavior appends to the most recent one if no ID is specified).
            if not effective_conv_id:
                try:
                    last_id = await client.chat.get_conversation_id(notebook_id)
                    if last_id:
                        await client.chat.delete_conversation(notebook_id, last_id)
                except Exception:
                    pass

            # Perform the ask
            result = await client.chat.ask(notebook_id, question, conversation_id=effective_conv_id)
            
            output = {
                "ok": True,
                "answer": result.answer,
                "conversation_id": result.conversation_id,
                "turn_number": result.turn_number
            }
            return output
            
    except Exception as e:
        return {
            "ok": False,
            "error": str(e)
        }

def main():
    parser = argparse.ArgumentParser(description="NotebookLM Multi-turn Ask Helper")
    parser.add_argument("-n", "--notebook-id", required=True, help="Notebook ID")
    parser.add_argument("-c", "--conversation-id", default=None, help="Conversation ID (or 'new')")
    parser.add_argument("-q", "--question", required=True, help="Question to ask")
    args = parser.parse_args()

    result = asyncio.run(run_ask(args.notebook_id, args.conversation_id, args.question))
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
