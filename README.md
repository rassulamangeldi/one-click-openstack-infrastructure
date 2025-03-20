*** Limitations:

- After creating talos k8s cluster, helm charts can't be installed during one pulumi up run. Need to w8 for cluster bootstrap for few seconds. Workaround - pulumi up second time
- Changed CoreDNS CM MANUALLY !!!!! (NEED A FIX THIS SOMEHOW)