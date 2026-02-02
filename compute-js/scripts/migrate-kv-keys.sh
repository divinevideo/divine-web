#!/bin/bash
# ABOUTME: Migrate divine-names KV store keys from old format to new format
# ABOUTME: Old format: "username" -> New format: "user:username"

STORE_ID="gclbp6suv4bjnqpctp2b7n"

echo "Fetching all keys from divine-names KV store..."

# Get all keys that don't have the user: prefix
OLD_KEYS=$(fastly kv-store-entry list --store-id "$STORE_ID" 2>&1 | grep -v "^user:" | grep -v "Getting data" | grep -v "^|" | grep -v "^/" | grep -v "^✓" | grep -v "^$")

echo "Found old-format keys to migrate:"
echo "$OLD_KEYS"
echo ""

# Count
COUNT=$(echo "$OLD_KEYS" | grep -c "." || echo "0")
echo "Total keys to migrate: $COUNT"
echo ""

read -p "Proceed with migration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

MIGRATED=0
FAILED=0

for KEY in $OLD_KEYS; do
    # Skip empty lines
    [[ -z "$KEY" ]] && continue

    NEW_KEY="user:$KEY"

    echo "Migrating: $KEY -> $NEW_KEY"

    # Get the value
    VALUE=$(fastly kv-store-entry get --store-id "$STORE_ID" --key "$KEY" 2>&1)

    if [[ $? -ne 0 ]] || [[ -z "$VALUE" ]]; then
        echo "  ERROR: Failed to read $KEY"
        ((FAILED++))
        continue
    fi

    # Check if new key already exists
    EXISTING=$(fastly kv-store-entry get --store-id "$STORE_ID" --key "$NEW_KEY" 2>&1)
    if [[ $? -eq 0 ]] && [[ -n "$EXISTING" ]]; then
        echo "  SKIP: $NEW_KEY already exists"
        continue
    fi

    # Write to new key
    echo "$VALUE" | fastly kv-store-entry create --store-id "$STORE_ID" --key "$NEW_KEY" --stdin 2>&1

    if [[ $? -eq 0 ]]; then
        echo "  OK: Created $NEW_KEY"
        ((MIGRATED++))
    else
        echo "  ERROR: Failed to create $NEW_KEY"
        ((FAILED++))
    fi
done

echo ""
echo "Migration complete!"
echo "Migrated: $MIGRATED"
echo "Failed: $FAILED"
echo ""
echo "NOTE: Old keys were NOT deleted. You can delete them manually after verifying the migration."
