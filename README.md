**Limitations:

- After creating talos k8s cluster, helm charts can't be installed during one pulumi up run. Need to w8 for cluster bootstrap for few seconds. Workaround - pulumi up second time

- Changed CoreDNS CM MANUALLY !!!!! (NEED TO FIX THIS SOMEHOW)
```sh
k edit cm <CoreDNS-CM-Name> -n kube-system
```
```yaml
forward . /etc/resolv.conf -> forward . 1.1.1.1 8.8.8.8
```