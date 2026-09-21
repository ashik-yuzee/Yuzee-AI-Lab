import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StructuredResponse, OutputSection } from '../../services/chat.service';
import { GuidanceListComponent } from '../guidance-list/guidance-list.component';

@Component({
  selector: 'app-protocol-renderer',
  standalone: true,
  imports: [CommonModule, FormsModule, GuidanceListComponent],
  templateUrl: './protocol-renderer.component.html',
  styleUrls: ['./protocol-renderer.component.scss'],
})
export class ProtocolRendererComponent implements OnInit {
  @Input() response!: StructuredResponse;
  @Output() interactionSubmit = new EventEmitter<{ sectionType: string; answer: any }>();

  selectedChoices = new Set<string>();
  ownAnswer = '';

  ngOnInit(): void {}

  toggleChoice(id: string): void {
    if (this.selectedChoices.has(id)) {
      this.selectedChoices.delete(id);
    } else {
      this.selectedChoices.add(id);
    }
  }

  canSubmitInteraction(section: OutputSection): boolean {
    if (section.choices?.length) return this.selectedChoices.size > 0;
    return this.ownAnswer.trim().length > 0;
  }

  submitInteraction(section: OutputSection): void {
    const answer = section.choices?.length
      ? Array.from(this.selectedChoices)
      : this.ownAnswer.trim();

    this.interactionSubmit.emit({ sectionType: section.type, answer });

    this.selectedChoices.clear();
    this.ownAnswer = '';
  }
}
