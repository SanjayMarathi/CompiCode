FROM debian:trixie-slim

# Toolchains submissions are judged with, plus the header libraries the server is built on.
RUN apt-get update && apt-get install -y \
    g++ \
    default-jdk-headless \
    python3 \
    libcpp-httplib-dev \
    nlohmann-json3-dev \
    tini \
    && rm -rf /var/lib/apt/lists/*

# Programs print UTF-8 (Java falls back to ASCII without this).
ENV LANG=C.UTF-8

# Precompile <bits/stdc++.h> with the judge's flags (-O2) so submissions that
# include it compile several times faster. g++ picks the .gch up automatically.
RUN HDR=$(echo '#include <bits/stdc++.h>' | g++ -O2 -x c++ -H -fsyntax-only - 2>&1 | grep -m1 'bits/stdc++.h' | sed 's/^\.* *//') \
    && g++ -O2 -x c++-header "$HDR" -o "$HDR.gch" \
    && echo "Precompiled $HDR"

WORKDIR /app
COPY server.cpp .
RUN g++ -O2 -std=c++17 -Wall -Wextra -o executor server.cpp -lcpp-httplib -pthread

EXPOSE 7860
# tini runs as PID 1 and reaps processes that submissions leave behind;
# otherwise they would pile up as zombies under the server.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["./executor"]
