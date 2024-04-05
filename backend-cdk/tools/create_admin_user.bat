set user="admin"
FOR /F "usebackq delims== tokens=1,2" %%i IN ("..\.env") do SET %%i=%%j

aws cognito-idp admin-create-user ^
--user-pool-id %USER_POOL_ID% ^
--username %user% ^
--user-attributes Name=email,Value="dummy@example.com" Name=email_verified,Value=true ^
--message-action SUPPRESS

aws cognito-idp admin-set-user-password ^
--user-pool-id %USER_POOL_ID% ^
--username %user% ^
--password beePrompt123 ^
--no-permanent

aws cognito-idp admin-add-user-to-group ^
--user-pool-id %USER_POOL_ID% ^
--username %user% ^
--group-name privileged

aws cognito-idp admin-add-user-to-group ^
--user-pool-id %USER_POOL_ID% ^
--username %user% ^
--group-name active

aws cognito-idp admin-add-user-to-group ^
--user-pool-id %USER_POOL_ID% ^
--username %user% ^
--group-name admin

