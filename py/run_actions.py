import json
import time

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service

from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import Select


# load recorded actions
with open("actions.json") as f:
    actions = json.load(f)


# start browser
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))

driver.get("https://the-internet.herokuapp.com/")

def merge_inputs(actions):

    merged = []

    i = 0
    while i < len(actions):

        action = actions[i]

        if action["type"] == "input":

            selector = action["selector"]
            last_value = action["value"]

            j = i + 1

            # collect consecutive inputs on the same selector
            while (
                j < len(actions)
                and actions[j]["type"] == "input"
                and actions[j]["selector"] == selector
            ):
                last_value = actions[j]["value"]
                j += 1

            merged.append({
                "type": "input",
                "selector": selector,
                "value": last_value
            })

            i = j
            continue

        merged.append(action)
        i += 1

    return merged

def run_action(action):

    action_type = action["type"]
    selector = action["selector"]

    if action_type == "redirect":
        driver.get(action["url"])

    element = driver.find_element(By.CSS_SELECTOR, selector)

    if action_type == "click":
        element.click()

    elif action_type == "input":
        element.clear()
        element.send_keys(action["value"])

    elif action_type == "select":
        select = Select(element)
        select.select_by_value(action["value"])

actions = merge_inputs(actions)
for action in actions:

    try:
        run_action(action)
        time.sleep(0.5)  # small delay between steps

    except Exception as e:
        print("Failed step:", action)
        print(e)


time.sleep(3)
driver.quit()
