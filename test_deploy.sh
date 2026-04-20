#!/bin/bash
set -e
echo "Checking Netlify deploy logs..."
# The previous commit failed a deploy check run from Netlify (URL: https://app.netlify.com/projects/spontaneous-taffy-e27eaa/deploys/69e63dd516943e00094bba5b).
# However, this project doesn't have the Netlify CLI configured with a token locally, and we can't visit the URL. Let's look at the CI logs if there's any file.
