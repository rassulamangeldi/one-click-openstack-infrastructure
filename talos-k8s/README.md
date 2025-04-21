How to get talosconfig

```sh
pulumi stack output talosconfig --show-secrets > talosconfig
```

How to get kubeconfig

```sh
talosctl --talosconfig talosconfig -n <CONTROL_PLANE_IP> kubeconfig . > kubeconfig
```