# Guía del sandbox AWS

Resumen de `Guia para construir en AWS.pdf`. Usa la cuenta y los recursos de AWS solo de acuerdo con las instrucciones del evento. El acceso detallado se encuentra en el documento original; este archivo no reproduce su código de acceso.

## Acceso y coordinación

- La guía dirige a AWS Workshop Studio o a `https://catalog.workshops.aws/` y permite trabajar desde la consola web o desde la CLI.
- La organización indica que hay 25 ambientes y recomienda que una sola persona por equipo configure la cuenta, para evitar que el equipo termine usando más de un ambiente.
- El PDF remite a instrucciones de acceso adicionales. Sigue las instrucciones originales y los permisos asignados al equipo.

## Límites de seguridad

- No ingreses datos reales que contengan información personal o regulada, datos financieros o de pago, raza u origen étnico, opiniones políticas, creencias, afiliación sindical, datos genéticos o biométricos, orientación o vida sexual, datos de salud, ni código malicioso. Usa datos sintéticos.
- No crees buckets S3 con acceso público. Mantén habilitado S3 Block Public Access o aplica una política que restrinja el acceso.
- No abras a Internet los grupos de seguridad de EC2.
- No habilites acceso público para RDS o EMR.
- Crea solo los recursos necesarios; el uso excesivo puede provocar bloqueos del equipo de servicio.
- Limita las solicitudes a servicios de IA generativa, incluido Amazon Bedrock, a un máximo de 1 solicitud por segundo, según la guía del evento.
- No copies códigos de acceso ni credenciales al repositorio, a tickets o al chat.

## CLI sin compartir credenciales

Si la organización habilitó IAM Identity Center para el equipo, cada participante puede configurar su perfil en su propio entorno con `aws configure sso` y luego iniciar sesión con `aws sso login --profile <perfil>`. No pegues claves o tokens en el chat; usa solo el perfil temporal del sandbox y verifica con el organizador qué perfil y permisos corresponden.

**Fuente:** `Guia para construir en AWS.pdf`. Para la configuración actual de Identity Center, consulta la [guía oficial de AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html).
