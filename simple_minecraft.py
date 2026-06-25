# simple_minecraft.py
world = {}

def place_block(x, y, z, block_type):
    world[(x, y, z)] = block_type
    print(f"블록 {block_type}을 ({x}, {y}, {z})에 놓았습니다.")

def view_world():
    if not world:
        print("세계가 비어있습니다.")
        return
    print("\n현재 세계 상태:")
    for (x, y, z), block_type in world.items():
        print(f"({x}, {y}, {z}): {block_type}")

if __name__ == "__main__":
    print("간단한 텍스트 기반 마인크래프트 시뮬레이션")
    place_block(0, 0, 0, "흙")
    place_block(1, 0, 0, "돌")
    place_block(0, 1, 0, "잔디")
    view_world()
    place_block(0, 0, 1, "나무")
    view_world()
