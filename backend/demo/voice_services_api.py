#!/usr/bin/env python3
import requests


def tts_azure_list(azure_key):
    if not azure_key or azure_key == "YOUR_AZURE_SPEECH_KEY":
        raise ValueError("请先通过参数传入有效的 Azure Speech Key。")

    region = "eastus"

    url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/voices/list"

    headers = {
        "Ocp-Apim-Subscription-Key": azure_key
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        voices = response.json()

        # 筛选中文普通话
        zh_cn_voices = [
            item for item in voices
            if item.get("Locale") == "zh-CN"
        ]

        # 筛选女声
        female_voices = [
            item for item in zh_cn_voices
            if item.get("Gender") == "Female"
        ]

        for item in female_voices:
            print(
                f"{item['ShortName']} "
                f"- {item.get('LocalName', '')}"
            )

    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":

    # Azure Speech Key
    azure_key = "YOUR_AZURE_SPEECH_KEY"

    tts_azure_list(azure_key)
    