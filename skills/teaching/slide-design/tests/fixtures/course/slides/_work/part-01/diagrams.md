# Diagrams

```diagram
{"id": "d-agent-loop", "title": "วงรอบของ agent", "canvas": [12, 6],
 "nodes": [{"id": "n-user", "label": "ผู้ใช้", "concept": "user", "at": [0, 2], "size": [2, 1]},
           {"id": "n-model", "label": "Model", "concept": "model", "at": [5, 1], "size": [3, 1]},
           {"id": "n-tool", "label": "Tool", "concept": "tool", "at": [5, 4], "size": [3, 1]}],
 "edges": [{"id": "e-ask", "from": "n-user", "to": "n-model", "label": "คำถาม", "style": "solid"},
           {"id": "e-call", "from": "n-model", "to": "n-tool", "label": "tool call", "style": "solid"},
           {"id": "e-result", "from": "n-tool", "to": "n-model", "label": "ผลลัพธ์", "style": "dashed"},
           {"id": "e-answer", "from": "n-model", "to": "n-user", "label": "คำตอบ", "style": "solid"}],
 "groups": [{"id": "g-agent", "label": "agent", "concept": "agent", "members": ["n-model", "n-tool"]}],
 "badges": [{"id": "b1", "n": 1, "near": "n-model"}, {"id": "b2", "n": 2, "near": "e-call"}, {"id": "b3", "n": 3, "near": "e-result"}],
 "notes": []}
```

```diagram
{"id": "d-init", "title": "init_chat_model สร้างโมเดลจากชื่อ", "canvas": [12, 3],
 "nodes": [{"id": "n-name", "label": "\"openai:gpt-5\"", "concept": "value", "at": [0, 1], "size": [3, 1]},
           {"id": "n-init", "label": "init_chat_model", "concept": "function", "at": [4, 1], "size": [4, 1]},
           {"id": "n-chat", "label": "model", "concept": "model", "at": [9, 1], "size": [3, 1]}],
 "edges": [{"id": "e-name", "from": "n-name", "to": "n-init", "label": "", "style": "solid"},
           {"id": "e-make", "from": "n-init", "to": "n-chat", "label": "", "style": "solid"}],
 "groups": [], "badges": [], "notes": []}
```
