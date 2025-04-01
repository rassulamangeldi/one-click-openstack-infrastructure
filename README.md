**Limitations:

- After creating talos k8s cluster, helm charts can't be installed during one pulumi up run. Need to w8 for cluster bootstrap for few seconds. Workaround - pulumi up second time

- Changed CoreDNS CM MANUALLY !!!!! (NEED TO FIX THIS SOMEHOW)
```sh
k edit cm <CoreDNS-CM-Name> -n kube-system
```
```yaml
forward . /etc/resolv.conf -> forward . 1.1.1.1 8.8.8.8
```

- Pulumi operator CR didn't have enough permission
Workaround:
```sh
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: pulumi-kubernetes-operator-auth
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: system:auth-delegator
subjects:
  - kind: ServiceAccount
    namespace: pulumi-kubernetes-operator
    name: default
EOF
```
However, I guess it's possible to update it using helm values. Need to check

- If there is an issue with Ansible playbook, you should first delete the failed k8s job. No workaround

- Preconfigured docker image (reqs, vars, inventory, playbook) is used for Patroni ansible job. Can be done normally, if time allows to