# Plan Based Actions

This doc describe how to use plan mechanism to implement actions, including recognize tv show/movie, recognize episode by rule, recognize episode by AI, rename episode by rule, rename episode by AI.


** Design Principle**
* Immediate UI Response: The UI should immediately respond to user action for best UX

**Terms**

* Open Plan: The plan not in "succeeded" and "failed" status

## Rename Episode by Rule

1. User click the rename button
2. Create RenameEpisodePlan in idle status
- 2.1 TvShowPanel observed open plans, open Prompt and reflect to plan status
- 2.2 Move plan to preparing status, generate data prop, move plan to ready status
3. If user click confirm button, move plan to executing status
4. If user click cancel button, move plan to rejected status
5. Remove plan from store

Require rules, selected rule
Need selectedMediaMetadata to generate seasonModelForPreview

When user change selected rule, update seasonModelForPreview


## Rename Episode by AI

1. AI generate RenameEpisodePlan
2. AI notify UI the plan is ready, UI add plan to store and set the plan to ready status
3. TvShowPanel observed open plans, open Prompt and reflect to plan status
4. If user click confirm button, move plan to executing status
4. If user click cancel button, move plan to rejected status
5. Remove plan from store

## Recognize TV Show/Movie Plan

1. Create RecognizeTvShowOrMoviePlan in idle status
2. Move plan to preparing status, generate data prop, move plan to ready status
3. If user click confirm button, move plan to executing status
4. If user click cancel button, move plan to rejected status
5. Remove plan from store


## Recognize Episode Plan by Rule

1. Create RecognizeEpisodePlan in idle status
2. Move plan to preparing status, generate data prop, move plan to ready status
3. If user click confirm button, move plan to executing status
4. If user click cancel button, move plan to rejected status
5. Remove plan from store

## Recognize Episode Plan by AI

6. AI generate RecognizeEpisodePlan
7. AI notify UI the plan is ready, UI add plan to store and set the plan to ready status
8. TvShowPanel observed open plans, open Prompt and reflect to plan status
9.  If user click confirm button, move plan to executing status
10. If user click cancel button, move plan to rejected status
11. Remove plan from store
