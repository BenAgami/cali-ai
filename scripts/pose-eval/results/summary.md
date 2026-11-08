# Pose model evaluation

## push_up

| model             | subset | detection rate | mean confidence | frames | result |
| ----------------- | ------ | -------------- | --------------- | ------ | ------ |
| movenet_lightning | all    | 0.514          | 0.337           | 368    | FAIL   |
| movenet_lightning | hold   | 0.736          | 0.386           | 69     | FAIL   |
| movenet_thunder   | all    | 0.656          | 0.412           | 368    | FAIL   |
| movenet_thunder   | hold   | 0.626          | 0.364           | 69     | FAIL   |
| blazepose_full    | all    | 1.000          | 0.979           | 368    | PASS   |
| blazepose_full    | hold   | 1.000          | 0.988           | 69     | PASS   |

## pull_up

| model             | subset | detection rate | mean confidence | frames | result |
| ----------------- | ------ | -------------- | --------------- | ------ | ------ |
| movenet_lightning | all    | 0.725          | 0.407           | 309    | FAIL   |
| movenet_lightning | hold   | 0.767          | 0.413           | 78     | FAIL   |
| movenet_thunder   | all    | 0.745          | 0.419           | 309    | FAIL   |
| movenet_thunder   | hold   | 0.791          | 0.443           | 78     | FAIL   |
| blazepose_full    | all    | 1.000          | 0.934           | 309    | PASS   |
| blazepose_full    | hold   | 1.000          | 0.984           | 78     | PASS   |

## dip

| model             | subset | detection rate | mean confidence | frames | result |
| ----------------- | ------ | -------------- | --------------- | ------ | ------ |
| movenet_lightning | all    | 0.648          | 0.388           | 300    | FAIL   |
| movenet_lightning | hold   | 0.625          | 0.373           | 72     | FAIL   |
| movenet_thunder   | all    | 0.602          | 0.387           | 300    | FAIL   |
| movenet_thunder   | hold   | 0.736          | 0.429           | 72     | FAIL   |
| blazepose_full    | all    | 0.963          | 0.948           | 300    | PASS   |
| blazepose_full    | hold   | 1.000          | 0.986           | 72     | PASS   |

## squat

| model             | subset | detection rate | mean confidence | frames | result |
| ----------------- | ------ | -------------- | --------------- | ------ | ------ |
| movenet_lightning | all    | 0.982          | 0.664           | 427    | PASS   |
| movenet_lightning | hold   | 0.981          | 0.684           | 78     | PASS   |
| movenet_thunder   | all    | 0.989          | 0.700           | 427    | PASS   |
| movenet_thunder   | hold   | 0.989          | 0.715           | 78     | PASS   |
| blazepose_full    | all    | 0.997          | 0.898           | 427    | PASS   |
| blazepose_full    | hold   | 0.981          | 0.882           | 78     | PASS   |

Decision: blazepose_full (passes all four exercises; movenet_lightning: 1/4, movenet_thunder: 1/4, blazepose_full: 4/4)
