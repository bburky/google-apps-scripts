```sh
# copy template/ and modify

npx @google/clasp create --type webapp
npx @google/clasp push

# initial deploy
#npx @google/clasp deploy
# never seems to actually make a webapp, create it manually first

# update existing deployment
current_deployment=$(npx @google/clasp deployments | tail -n1 | cut -d' ' -f2)
npx @google/clasp deploy --deploymentId "${current_deployment}"

npx @google/clasp open --webapp
```