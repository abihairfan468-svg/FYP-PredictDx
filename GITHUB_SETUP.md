# Getting this project onto GitHub

## 1. Create the account

GitHub has **no "Sign in with Google" button**. Accounts use an email address and a password.
Use your Gmail address as the account email.

1. Go to <https://github.com/signup>
2. Email: `abihairfan468@gmail.com`
3. Pick a username you are happy to show an employer, for example `abiha-irfan`
4. Verify the email, then enable two-factor authentication when prompted
5. Optional but worth it: apply for the **GitHub Student Developer Pack** at
   <https://education.github.com/pack> with your Air University email
   (`@students.au.edu.pk`). It includes GitHub Copilot free.

## 2. Create the repository

1. Click **+** (top right) → **New repository**
2. Name: `predictdx`
3. Description: `AI multimodal system for early detection and risk prediction of chest diseases - FYP`
4. Select **Private**
5. Do **not** tick "Add a README" - this project already has one
6. **Create repository**

Then **Settings → Collaborators → Add people** and invite Rida and Khadija by their
GitHub usernames.

## 3. Install Git

- Windows: <https://git-scm.com/download/win> (accept the defaults)
- Check it worked: open a new terminal and run `git --version`

## 4. Push this project

Unzip `predictdx.zip` somewhere sensible, for example `D:\FYP\predictdx`, then:

```bash
cd D:/FYP/predictdx

git init -b main
git config user.name  "Abiha Irfan"
git config user.email "abihairfan468@gmail.com"

git add .
git status                 # check .env and datasets are NOT listed

git commit -m "chore: initial project scaffold - NestJS backend and FastAPI AI service"

git remote add origin https://github.com/<your-username>/predictdx.git
git push -u origin main
```

The first push opens a browser window to sign in to GitHub. Sign in there and it will
remember you.

## 5. Working as a team

Never commit straight to `main`. Each person works on a branch:

```bash
git checkout -b abiha/diagnosis-module
# ... make changes ...
git add .
git commit -m "feat(diagnosis): add X-ray upload and queue"
git push -u origin abiha/diagnosis-module
```

Then open a **Pull Request** on GitHub and have Rida review it before merging.
A real branch-and-PR history looks good in an FYP evaluation.

To get other people's work:

```bash
git checkout main
git pull
git checkout abiha/my-branch
git merge main
```

## 6. What must never be committed

`.gitignore` already blocks these, but check `git status` before your first commit:

- `.env` - contains your JWT secrets and database password
- `*.keras`, `*.h5` - model files, often over GitHub's 100 MB limit
- `dataset/`, `storage/`, `uploads/` - X-ray images, including patient data
- `node_modules/`, `.venv/`

If a secret is ever committed by accident, **change the secret** - deleting the file does
not remove it from Git history.

## 7. Commit message style

```
feat(diagnosis): add Grad-CAM overlay to the result response
fix(auth): reject expired refresh tokens
docs(readme): add stub mode instructions
chore(deps): upgrade prisma to 5.20
```

Consistent messages make the commit history readable in your final report.
