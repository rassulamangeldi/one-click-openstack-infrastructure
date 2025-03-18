talosconfig

```sh
pulumi stack output talosconfig --show-secrets > talosconfig
```

kubeconfig

```sh
talosctl --talosconfig talosconfig -n <CONTROL_PLANE_IP> kubeconfig . > kubeconfig
```