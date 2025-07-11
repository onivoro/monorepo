variable "studio_user_profile_name" {
  description = "Name for the SageMaker Studio user profile"
  type        = string
  default     = "admin-user"
}

variable "instance_type" {
  description = "Instance size: ml.t3.micro ml.t3.small ml.t3.medium ml.t3.large ml.t3.xlarge ml.t3.2xlarge ml.m5.large ml.m5.xlarge ml.m5.2xlarge ml.m5.4xlarge ml.m5.8xlarge ml.m5.12xlarge ml.m5.16xlarge ml.m5.24xlarge ml.m5d.large ml.m5d.xlarge ml.m5d.2xlarge ml.m5d.4xlarge ml.m5d.8xlarge ml.m5d.12xlarge ml.m5d.16xlarge ml.m5d.24xlarge ml.c5.large ml.c5.xlarge ml.c5.2xlarge ml.c5.4xlarge ml.c5.9xlarge ml.c5.12xlarge ml.c5.18xlarge ml.c5.24xlarge ml.p3.2xlarge ml.p3.8xlarge ml.p3.16xlarge ml.p3dn.24xlarge ml.g4dn.xlarge ml.g4dn.2xlarge ml.g4dn.4xlarge ml.g4dn.8xlarge ml.g4dn.12xlarge ml.g4dn.16xlarge ml.r5.large ml.r5.xlarge ml.r5.2xlarge ml.r5.4xlarge ml.r5.8xlarge ml.r5.12xlarge ml.r5.16xlarge ml.r5.24xlarge ml.g5.xlarge ml.g5.2xlarge ml.g5.4xlarge ml.g5.8xlarge ml.g5.16xlarge ml.g5.12xlarge ml.g5.24xlarge ml.g5.48xlarge ml.g6.xlarge ml.g6.2xlarge ml.g6.4xlarge ml.g6.8xlarge ml.g6.12xlarge ml.g6.16xlarge ml.g6.24xlarge ml.g6.48xlarge ml.g6e.xlarge ml.g6e.2xlarge ml.g6e.4xlarge ml.g6e.8xlarge ml.g6e.12xlarge ml.g6e.16xlarge ml.g6e.24xlarge ml.g6e.48xlarge ml.geospatial.interactive ml.p4d.24xlarge ml.p4de.24xlarge ml.trn1.2xlarge ml.trn1.32xlarge ml.trn1n.32xlarge ml.p5.48xlarge ml.m6i.large ml.m6i.xlarge ml.m6i.2xlarge ml.m6i.4xlarge ml.m6i.8xlarge ml.m6i.12xlarge ml.m6i.16xlarge ml.m6i.24xlarge ml.m6i.32xlarge ml.m7i.large ml.m7i.xlarge ml.m7i.2xlarge ml.m7i.4xlarge ml.m7i.8xlarge ml.m7i.12xlarge ml.m7i.16xlarge ml.m7i.24xlarge ml.m7i.48xlarge ml.c6i.large ml.c6i.xlarge ml.c6i.2xlarge ml.c6i.4xlarge ml.c6i.8xlarge ml.c6i.12xlarge ml.c6i.16xlarge ml.c6i.24xlarge ml.c6i.32xlarge ml.c7i.large ml.c7i.xlarge ml.c7i.2xlarge ml.c7i.4xlarge ml.c7i.8xlarge ml.c7i.12xlarge ml.c7i.16xlarge ml.c7i.24xlarge ml.c7i.48xlarge ml.r6i.large ml.r6i.xlarge ml.r6i.2xlarge ml.r6i.4xlarge ml.r6i.8xlarge ml.r6i.12xlarge ml.r6i.16xlarge ml.r6i.24xlarge ml.r6i.32xlarge ml.r7i.large ml.r7i.xlarge ml.r7i.2xlarge ml.r7i.4xlarge ml.r7i.8xlarge ml.r7i.12xlarge ml.r7i.16xlarge ml.r7i.24xlarge ml.r7i.48xlarge ml.m6id.large ml.m6id.xlarge ml.m6id.2xlarge ml.m6id.4xlarge ml.m6id.8xlarge ml.m6id.12xlarge ml.m6id.16xlarge ml.m6id.24xlarge ml.m6id.32xlarge ml.c6id.large ml.c6id.xlarge ml.c6id.2xlarge ml.c6id.4xlarge ml.c6id.8xlarge ml.c6id.12xlarge ml.c6id.16xlarge ml.c6id.24xlarge ml.c6id.32xlarge ml.r6id.large ml.r6id.xlarge ml.r6id.2xlarge ml.r6id.4xlarge ml.r6id.8xlarge ml.r6id.12xlarge ml.r6id.16xlarge ml.r6id.24xlarge ml.r6id.32xlarge"
  type        = string
  default     = "ml.t3.medium"
}

variable "redshift_workgroup_name" {
  description = "The name of the existing Redshift workgroup."
  type        = string
}

variable "iam_user_group_name" {
  description = "The name of the IAM user group to grant permissions."
  type        = string
}

variable "sagemaker_notebook_name" {
  description = "The name of the SageMaker notebook instance."
  type        = string
  default     = "sagemaker-sql-notebook"
}

variable "region" {
  description = "AWS region for the resources."
  type        = string
  default     = "us-east-1"
}

variable "redshift_arn" {
  description = "the Redshift ARN"
  type = string
}

variable "vpc_id" {
  description = "The ID of the VPC where SageMaker Studio domain will be created"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for SageMaker Studio domain"
  type        = list(string)
}