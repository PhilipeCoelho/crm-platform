#!/usr/bin/env python3
"""
Oracle Cloud VM Hunter (Madrid AD-1) - Vamuss SDR Autonomous Deployer
Monitora continuamente e adquire automaticamente a máquina gratuita Always Free
assim que a Oracle liberar capacidade em Madrid.
"""

import os
import sys
import time
import json
import subprocess
from datetime import datetime
import oci

CONFIG_PATH = os.path.expanduser("~/.oci/config")
KEY_PATH = os.path.expanduser("~/.oci/oci_api_key.pem")
OUTPUT_STATE_FILE = os.path.join(os.path.dirname(__file__), "../data/oracle_instance_created.json")
LOG_FILE = os.path.join(os.path.dirname(__file__), "../data/oracle_hunter.log")

# Parâmetros Homologados
AD = "Jmxn:EU-MADRID-1-AD-1"
SUBNET_ID = "ocid1.subnet.oc1.eu-madrid-1.aaaaaaaaijfnkei5jc6ajuqq6smoe4enlr4l3rr25gjd7lfpmexwtqjo7ooa"
IMAGE_ARM_UBUNTU_22 = "ocid1.image.oc1.eu-madrid-1.aaaaaaaatzdau52ee3255u7zpd3dpvzniem5kj5zxx7u5j2afwxqnct6lroq"
IMAGE_AMD_UBUNTU_22 = "ocid1.image.oc1.eu-madrid-1.aaaaaaaadjgyol47izs7dcacm5dr4bk2e4gktrzmbpka3bhnqqvpz6xc4bjq"

SSH_PUBLIC_KEY = """ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDM2QzuaCWvry/RtVYPlzTNdRyLbYfB6781nTBjLcEDrJA1ndrooFBcIf+awYfmx8rmnbucs/Oy4VkbwTDBEBfWG2WHlNrW73kXA2ZizqckH1xhEgSM09zrusi58RHmgdwkOItb00PUUwSfj16FnOPTVwcQLR0zU/OYJVXGQir4Cy+v30yPJaLUOOQkTZir59LAKDRP86GGf+gB8t1BpswJJCVfzCgqpkkQH6Zjwe7Lx15KUSdcx2Q6c+yE24ULq94MJh8tmLu7jPTzNP/clmn5Y6e2EV+APgYYDD5vQSPebSWh8NMq9uP2012uRgxe9VtbvP1AGHgVwTS3WEJONN/V ssh-key-2026-10-30"""

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"[{ts}] {msg}"
    print(formatted)
    sys.stdout.flush()
    try:
        with open(LOG_FILE, "a") as f:
            f.write(formatted + "\n")
    except Exception:
        pass

def notify_user_mac(title, message):
    try:
        # Notificação nativa do macOS
        script = f'display notification "{message}" with title "{title}" sound name "Glass"'
        subprocess.run(["osascript", "-e", script], check=False)
        # Tocar som de vitória
        subprocess.run(["afplay", "/System/Library/Sounds/Glass.aiff"], check=False)
    except Exception as e:
        log(f"Aviso local erro: {e}")

def attempt_launch(compute_client, tenancy_id, shape_type="ARM"):
    if shape_type == "ARM":
        shape = "VM.Standard.A1.Flex"
        shape_config = oci.core.models.LaunchInstanceShapeConfigDetails(ocpus=1.0, memory_in_gbs=4.0)
        image_id = IMAGE_ARM_UBUNTU_22
        name = "vamuss-sdr-arm"
    else:
        shape = "VM.Standard.E2.1.Micro"
        shape_config = None
        image_id = IMAGE_AMD_UBUNTU_22
        name = "vamuss-sdr-amd"

    details = oci.core.models.LaunchInstanceDetails(
        availability_domain=AD,
        compartment_id=tenancy_id,
        display_name=name,
        shape=shape,
        shape_config=shape_config,
        source_details=oci.core.models.InstanceSourceViaImageDetails(image_id=image_id),
        create_vnic_details=oci.core.models.CreateVnicDetails(
            subnet_id=SUBNET_ID,
            assign_public_ip=True,
            display_name=f"{name}-vnic"
        ),
        metadata={
            "ssh_authorized_keys": SSH_PUBLIC_KEY
        }
    )

    return compute_client.launch_instance(details).data

def main():
    log("🚀 [Oracle Hunter] Iniciando caçador de capacidade Always Free (Madrid AD-1)...")
    config = oci.config.from_file(CONFIG_PATH)
    config["key_file"] = KEY_PATH
    compute_client = oci.core.ComputeClient(config)
    virtual_net = oci.core.VirtualNetworkClient(config)
    tenancy_id = config["tenancy"]

    attempt = 0
    # Intervalo entre rondas (120s respeita a quota de rate-limit da Oracle)
    interval_seconds = 120

    while True:
        attempt += 1
        log(f"🎯 Ronda #{attempt}: Sondando capacidade de servidores Always Free...")

        # Tenta Ampere ARM (4GB RAM, 1 OCPU - Shape superior Always Free)
        try:
            instance = attempt_launch(compute_client, tenancy_id, shape_type="ARM")
            handle_success(instance, virtual_net, tenancy_id, shape="Ampere ARM (4GB)")
            break
        except oci.exceptions.ServiceError as e:
            if "Out of host capacity" in str(e.message) or e.status == 500:
                log(f"   ⏳ Ampere ARM: Sem vagas no momento (Out of host capacity).")
            elif e.status == 429:
                log(f"   ⏳ Rate limit temporário da Oracle (429). Aguardando...")
            else:
                log(f"   ⚠️ Ampere ARM erro: [{e.status}] {e.code} - {e.message}")

        log(f"💤 Aguardando {interval_seconds}s para a próxima tentativa...\n")
        time.sleep(interval_seconds)

def handle_success(instance, virtual_net, tenancy_id, shape):
    msg = f"🎉 VITÓRIA! Máquina {shape} criada com sucesso! ID: {instance.id}"
    log(msg)

    # Obter IP público atribuído
    time.sleep(10)
    public_ip = "A provisionar..."
    try:
        vnics = virtual_net.list_vnic_attachments(compartment_id=tenancy_id, instance_id=instance.id).data
        if vnics:
            vnic = virtual_net.get_vnic(vnics[0].vnic_id).data
            public_ip = vnic.public_ip or "A provisionar..."
    except Exception as e:
        log(f"Erro ao obter IP: {e}")

    result = {
        "success": True,
        "timestamp": datetime.now().isoformat(),
        "instance_id": instance.id,
        "display_name": instance.display_name,
        "shape": shape,
        "public_ip": public_ip,
        "ssh_user": "ubuntu",
        "ssh_key": "/Users/philipecoelho/Downloads/ssh-key-2026-10-30.key"
    }

    with open(OUTPUT_STATE_FILE, "w") as f:
        json.dump(result, f, indent=2)

    notify_user_mac(
        "🎉 Oracle Cloud Hunter",
        f"Máquina {shape} criada com sucesso! IP: {public_ip}"
    )
    log("🏁 Caçador finalizou com sucesso total.")

if __name__ == "__main__":
    main()
