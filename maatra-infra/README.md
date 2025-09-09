# 🚀 Maatra Terraform ECS Deployment Guide

This project sets up the infrastructure for deploying a FastAPI backend and Next.js frontend using AWS ECS Fargate, ALB, and Service Discovery with Terraform.

---

## ✅ Prerequisites

1. [Install Terraform](https://developer.hashicorp.com/terraform/downloads)
2. [Install AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
3. Ensure your AWS credentials are set either via `aws configure` or environment variables:

```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=ap-southeast-1  # Change as needed
```

---

## ⚙️ Configuration

1. **Set AWS Region** in `variables.tf`:
   > Change the `region` variable. For testing, keep it `ap-southeast-1` (Singapore) or your preferred region.

```hcl
variable "region" {
  default = "ap-southeast-1"
}
```

---

## 🔐 AWS Credentials Setup for bedrock API
Create `terraform.tfvars` file in the root directory, then add:

```hcl
aws_access_key_id     = "EXAMPLEKEY"
aws_secret_access_key = "YOUR_SECRET_KEY"
```
Replace both values with your actual AWS credentials.

## 📦 Terraform Workflow

1. **Initialize Terraform**

```bash
terraform init
```

2. **Review Planned Changes**

```bash
terraform plan
```

3. **Deploy Infrastructure**

```bash
terraform apply
```

---

## 🐳 Post-Deployment

After deployment completes:

1. **Push Docker Images to ECR**
   - Trigger GitHub Actions or manually build and push both frontend and backend Docker images.

2. **Verify ECS Services**
   - Go to AWS ECS Console.
   - Ensure both **FastAPI** and **Next.js** services are running.

3. **If Any Service is Stopped**
   - Re-run Terraform to reapply configuration:
     ```bash
     terraform apply
     ```
   - Ensure **both ECR images** are available before reapplying.

4. **Test Application**
   - Go to the **ALB (Application Load Balancer)** in the AWS Console.
   - Copy the **DNS Name** and test the frontend in your browser.

---

## 💥 Tear Down (Destroy)

To remove all deployed infrastructure:

```bash
terraform destroy
```

> If you get an error related to ECR image deletion:
- Go to AWS ECR Console.
- **Manually delete all pushed images** in both repositories.
- Re-run:
  ```bash
  terraform destroy
  ```

---

## 📁 Project Structure

```bash
.
├── alb.tf
├── ecs_fastapi.tf
├── ecs_nextjs.tf
├── ecr.tf
├── iam.tf
├── main.tf
├── outputs.tf
├── security_groups.tf
├── variables.tf
├── vpc.tf
└── README.md
```

---

## 📌 Notes

- This setup uses:
  - **ECS Fargate**
  - **Application Load Balancer (ALB)**
  - **Private DNS Service Discovery (Cloud Map)**
- Be sure your IAM user or role has sufficient permissions (including `servicediscovery:*` and `ecs:*`).

---
