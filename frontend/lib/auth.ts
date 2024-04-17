"use client";

import { withAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

import { Amplify } from "aws-amplify";

import { awsUserPoolConfig } from "./environments";

// aws-exports.jsより転記
const amplifyConfig = {
  ...awsUserPoolConfig,
  aws_project_region: "ap-northeast-1",
  aws_cognito_region: "ap-northeast-1",
  aws_cognito_signup_attributes: ["EMAIL"],
  aws_cognito_verification_mechanisms: ["EMAIL"],
};
Amplify.configure(amplifyConfig);

function Auth({ children }: { children: React.ReactNode }) {
  return children;
}
export default withAuthenticator(Auth, { hideSignUp: true });
