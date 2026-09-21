import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GuidanceItem } from '../../services/chat.service';

@Component({
  selector: 'app-guidance-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './guidance-list.component.html',
})
export class GuidanceListComponent {
  @Input() items: GuidanceItem[] = [];
  @Input() ordered = false; // false = cards, true = timeline steps
}
