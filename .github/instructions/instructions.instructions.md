---
applyTo: "**"
---
# 🤖 INSTRUCTIONS FOR AI (GitHub Copilot / LLMs)

This document explains **how the AI must operate inside this repository**, and how it should use this project's 3 core specification files:

- `FEATURES_LIST.md` – Functional requirements & checklist   

These files **define the source of truth** for the project.  
Whenever the AI generates or updates code, it must do so **in alignment with these three documents**.

---

# 1. 📘 FEATURES_LIST.md — Functional Requirements & TODO Progress

### Purpose
This file contains:
- All functional requirements for the app  
- The TODO list of features  
- The acceptance criteria for each feature  
- The roadmap (MVP → v1.0 → later versions)

### How the AI should use this file
The AI **must consult this file first** when:
- Generating new features  
- Updating existing features  
- Checking what remains to be built  
- Ensuring the output matches expected behavior  
- Understanding business logic & domain concepts  

# 5. 🧠 What AI Should Always Do

When generating, modifying, or explaining code, the AI must:

### ✔ Always use TypeScript for backend code  
### ✔ Always follow hexagonal architecture  
### ✔ Always maintain clean separation of responsibilities  
### ✔ Always ensure Firestore writes/queries follow security rules  
### ✔ Always write clear, typed, maintainable code  
### ✔ Always document decisions matching the spec files  
### ✔ Always run tests inside the docker container and not rely on local environment (use docker directly and not docker-compose). Don't reinstall the environment with pnpm, just execute the tests.
### ✔ Always add tests when coding new features or fixing bugs

---

# 6. 🚫 What the AI Must Never Do

- ❌ Bypass domain logic by putting business rules in controllers  
- ❌ Mix UI business logic with backend logic  
- ❌ Put Firebase code inside domain layer  
- ❌ Change the wireframes unless explicitly requested  
- ❌ Use Python or any non-TypeScript backend  
- ❌ Implement direct client-to-Firestore changes (always go via BFF unless the architecture evolves explicitly)

---

# 7. 📄 When the AI Generates Files

The AI should:
- Use consistent naming (from the domain models)
- Write strongly typed TypeScript code
- Follow NestJS + Fastify conventions
- If in doubt, prefer simplicity and maintainability
- Document any assumptions

---

If an instruction or implementation cannot be resolved, the AI should:
1. Explain the ambiguity
2. Suggest a solution consistent with all three files
3. Wait for user confirmation only if absolutely required

---

This file ensures consistent collaboration between humans and AI throughout the entire project lifecycle.
