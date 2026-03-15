import json
import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service

from webdriver_manager.chrome import ChromeDriverManager


# load recorded actions
with open("actions.json") as f:
    actions = json.load(f)


# start browser
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))

driver.get("https://google.com")


def run_action(action):

    action_type = action["type"]
    selector = action["selector"]

    element = driver.find_element(By.CSS_SELECTOR, selector)

    if action_type == "click":
        element.click()

    elif action_type == "input":
        element.clear()
        element.send_keys(action["value"])


for action in actions:

    try:
        run_action(action)
        time.sleep(0.5)  # small delay between steps

    except Exception as e:
        print("Failed step:", action)
        print(e)


time.sleep(3)
driver.quit()
