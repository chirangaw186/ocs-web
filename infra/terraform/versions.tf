terraform {
  required_version = ">= 1.10"
  required_providers {
    aws     = { source = "hashicorp/aws", version = "~> 6.0" }
    archive = { source = "hashicorp/archive", version = "~> 2.7" }
  }
  # Remote state in S3 (create the bucket once by hand). use_lockfile needs Terraform >= 1.10.
  # backend "s3" {
  #   bucket       = "pavielle-terraform-state"
  #   key          = "prod/terraform.tfstate"
  #   region       = "ap-southeast-1"
  #   use_lockfile = true
  # }
}

provider "aws" {
  region = var.region
  default_tags { tags = { app = "pavielle", stage = var.stage } }
}
