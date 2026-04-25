# Deploy automático a AWS

Cada `push` a `main` que toque `frontend/`, `backend/` o `docker-compose.prod.yml` dispara el workflow [.github/workflows/deploy.yml](../.github/workflows/deploy.yml), que:

1. Buildea las imágenes de frontend y backend en paralelo.
2. Las sube a ECR con dos tags: `latest` y el SHA del commit.
3. Hace SSH al EC2, pull de las imágenes nuevas y restart del stack via `docker compose`.

Las migraciones Alembic corren solas dentro del servicio `prestart` del compose, así que no hay que orquestarlas desde el workflow.

## Setup inicial (una sola vez)

### 1. OIDC Provider en AWS

Si la cuenta `314679576825` todavía no tiene el provider de GitHub:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 2. IAM Role `GitHubActionsDeployRole`

**Trust policy** (solo permite a workflows del repo en la rama `main`):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::314679576825:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:IIAteeneaaII/NGcourses:ref:refs/heads/main"
      }
    }
  }]
}
```

**Permissions policy** (push a los dos repos de ECR):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage",
        "ecr:BatchGetImage"
      ],
      "Resource": [
        "arn:aws:ecr:us-west-2:314679576825:repository/ngcourses-frontend",
        "arn:aws:ecr:us-west-2:314679576825:repository/ngcourses-backend"
      ]
    }
  ]
}
```

### 3. GitHub Secrets

En `Settings → Secrets and variables → Actions → New repository secret`:

| Secret | Valor |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::314679576825:role/GitHubActionsDeployRole` |
| `EC2_HOST` | `44.250.178.54` |
| `EC2_USER` | `ec2-user` |
| `EC2_SSH_KEY` | Contenido completo de `ngcourses-key.pem` (incluyendo `-----BEGIN ...-----` y `-----END ...-----`) |

## Rollback

Desde el EC2:

```bash
# Listar SHAs disponibles en ECR
aws ecr describe-images --repository-name ngcourses-frontend --region us-west-2 \
  --query 'imageDetails[*].imageTags' --output table

# Volver a un SHA anterior
SHA=abc1234...
docker pull 314679576825.dkr.ecr.us-west-2.amazonaws.com/ngcourses-frontend:$SHA
docker tag 314679576825.dkr.ecr.us-west-2.amazonaws.com/ngcourses-frontend:$SHA \
          314679576825.dkr.ecr.us-west-2.amazonaws.com/ngcourses-frontend:latest
docker compose -f docker-compose.prod.yml up -d frontend
```

## Pausar el auto-deploy

- **Temporal**: `Actions → Deploy to AWS → ··· → Disable workflow`.
- **Permanente**: borrar `.github/workflows/deploy.yml`.

El script local `scripts/deploy-frontend.sh` queda como fallback manual.

## Verificación post-deploy

```bash
curl -I http://44.250.178.54/
curl http://44.250.178.54:8000/api/v1/utils/health-check/
ssh -i ngcourses-key.pem ec2-user@44.250.178.54 \
  'docker compose -f docker-compose.prod.yml ps'
```
