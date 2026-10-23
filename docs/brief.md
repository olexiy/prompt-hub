# Brief — Olexiy, 2026-10-23

Translated from Russian, kept close to the original wording.

> While working with ComfyUI I realised it is hard to keep track of prompts. I want to build a project called **Prompt Hub**: storing and versioning prompts for AI.
>
> It is for me; I don't think it will go anywhere else, but we build it from the start as a project meant for many users. It must run on the internet, with a database online, user authentication and security standards.
>
> In short:
>
> - You can create **projects**, and inside a project create **prompts**.
> - Every prompt has **versioning**.
> - You can put **variables** into a prompt and set their values later.
> - You can write **comments** on it, and add **meta fields** that are not part of the prompt but help to understand it.
> - Projects can be **public or private**, like on GitHub.
> - You can **upload prompts**, and upload a **whole project**.
> - **One-click copy** of a prompt to the clipboard with the variables substituted.
>
> That is only a small part of the features.
>
> First, the project should search for existing products of this kind and assess whether it is worth building my own at all. Then make a good plan where we discuss the features. After that, plan the architecture (frameworks first), then epics in separate milestones, and then we start development.

## Context

- Trigger: ComfyUI image/video work (Krea, MiniMax H3), where prompts come as long structured shot lists with many variants. Example material: the `prompts/` folder of the public repo `olexiy/comfy-h3-studio`.
- Olexiy's Obsidian vault has a `prompts/` folder (7 notes: coding, writing, research, health) — a possible first import.
- Olexiy is a senior Java/Spring Boot + Angular developer and IT consultant (banking, healthcare); security and clean architecture are expected.
