# Security Configuration

## Non-Root User Support

BentoPDF now supports running as a non-root user for enhanced security. This follows the Principle of Least Privilege and is essential for production environments.

### Security Benefits

- **Reduced Attack Surface**: If compromised, attackers won't have root privileges
- **Compliance**: Meets security standards like SOC 2, PCI DSS
- **Kubernetes/OpenShift Compatibility**: Works with security policies that require non-root execution
- **System Protection**: Prevents system-wide damage if the application is compromised

### Usage

#### Default Configuration (UID/GID 1001)
```bash
docker build -t bentopdf .
docker run -p 8080:80 bentopdf
```

#### Custom UID/GID
```bash
# Build with custom user/group IDs
docker build \
  --build-arg APP_USER_ID=2000 \
  --build-arg APP_GROUP_ID=2000 \
  -t bentopdf .

# Run the container
docker run -p 8080:80 bentopdf
```

#### Kubernetes Example
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bentopdf
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 2000
        runAsGroup: 2000
      containers:
      - name: bentopdf
        image: bentopdf:latest
        ports:
        - containerPort: 80
```

#### Docker Compose Example
```yaml
version: '3.8'
services:
  bentopdf:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        APP_USER_ID: 2000
        APP_GROUP_ID: 2000
    ports:
      - "8080:80"
    security_opt:
      - no-new-privileges:true
```

### Verification

To verify the container is running as non-root:

```bash
# Check the user inside the container
docker exec <container_id> whoami
# Should output: bentopdf

# Check the user ID
docker exec <container_id> id
# Should show UID/GID matching your configuration
```

### Security Best Practices

1. **Use specific UID/GID**: Don't use 0 (root) or common system UIDs
2. **Regular Updates**: Keep the base image updated
3. **Minimal Permissions**: Only grant necessary file permissions
4. **Security Scanning**: Regularly scan images for vulnerabilities
5. **Network Policies**: Implement network segmentation

### Troubleshooting

If you encounter permission issues:

1. **Check file ownership**: Ensure all application files are owned by the bentopdf user
2. **Verify UID/GID**: Make sure the configured IDs don't conflict with host system
3. **Directory permissions**: Ensure nginx can write to log and cache directories

### Migration from Root

If migrating from a root-based setup:

1. Update your Dockerfile to use the new non-root configuration
2. Rebuild your images with the new security settings
3. Update your deployment configurations (Kubernetes, Docker Compose, etc.)
4. Test thoroughly in a staging environment
