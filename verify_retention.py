#!/usr/bin/env python3
import subprocess
import json
import sys

# Define the targets
NOTEBOOK_ID = "73085c64-dea5-4945-9226-949023b0ac9b"
TEST_CONVERSATIONS = {
    "A (PM / 硬體)": {
        "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "question": "確認一下：在我們這段對話中，我是什麼身份？我們剛才最後討論到的舞台斷電當下是誰衝去搶救的？",
        "expected_keyword": "溫蒂"
    },
    "B (財務 / 核銷)": {
        "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "question": "確認一下：在我們這段對話中，我是什麼身份？我們剛才最後討論到在無預算時場地圖建議用什麼呈現？",
        "expected_keyword": "A3"
    },
    "C (行政 / 流程)": {
        "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
        "question": "確認一下：在我們這段對話中，我是什麼身份？我們剛才最後討論到的設計審核延誤痛點原因是什麼？",
        "expected_keyword": "休假"
    },
    "D (主辦人 / 應變)": {
        "id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
        "question": "確認一下：在我們這段對話中，我是什麼身份？我們剛才最後討論到為防範工作人員中暑抽筋，建議準備什麼與租用什麼？",
        "expected_keyword": "運動飲料"
    }
}

def check_conversation(name, info):
    print(f"=== 正在測試對話 {name} (ID: {info['id']}) ===")
    cmd = [
        ".venv/bin/notebooklm", "ask",
        "-n", NOTEBOOK_ID,
        "-c", info["id"],
        info["question"]
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        answer = result.stdout
        print("AI 回覆內容:")
        print(answer.strip())
        
        # Check if expected keyword exists to verify context memory
        if info["expected_keyword"] in answer:
            print(f"\n[SUCCESS] 對話 {name} 記憶完好！(成功識別關鍵字: '{info['expected_keyword']}')")
        else:
            print(f"\n[WARNING] 對話 {name} 能回答，但可能丟失了精確上下文 (未找到關鍵字: '{info['expected_keyword']}')")
    except subprocess.CalledProcessError as e:
        print(f"\n[FAILED] 對話 {name} 查詢失敗！錯誤碼: {e.returncode}")
        print(f"錯誤輸出: {e.stderr}")
    print("-" * 50)

def main():
    print("==================================================")
    print("         NotebookLM 對話記憶時效驗證工具            ")
    print("==================================================")
    for name, info in TEST_CONVERSATIONS.items():
        check_conversation(name, info)

if __name__ == "__main__":
    main()
