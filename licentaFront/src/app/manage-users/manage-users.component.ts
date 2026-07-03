import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsersService } from '../services/users.service';
import { Contract, ContractService } from '../services/contract.service';
import { FormsModule, NgModel } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { AgGridModule } from 'ag-grid-angular';
import { ModuleRegistry,
  ClientSideRowModelModule,
  ValidationModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  SelectEditorModule } from 'ag-grid-community';
import { CsvExportModule } from 'ag-grid-community';


ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ValidationModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  CsvExportModule,
  SelectEditorModule
]);
@Component({
  selector: 'app-manage-users',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, AgGridModule],
  templateUrl: './manage-users.component.html',
  styleUrls: ['./manage-users.component.css']
})
export class ManageUsersComponent implements OnInit {
  users: any[] = [];
  contracts: Contract[] = [];
  isLoading = true;
  error: string | null = null;
  contractDropdownOptions: { id: number, name: string }[] = [];
  

  selectedContractId: number | null = null;
  editingUserId: number | null = null;

  selectedRole: string | null = null;
  editingRoleUserId: number | null = null;

  // columnDefs = [
  //   { field: 'id', headerName: 'ID', sortable: true, filter: true },
  //   { field: 'username', headerName: 'Username', sortable: true, filter: true },
  //   { field: 'address', headerName: 'Address', sortable: true, filter: true },
  //   {
  //     field: 'role',
  //     headerName: 'Role',
  //     cellRenderer: (params: any) => {
  //       return params.value === '1' ?'Manager' : 'User';
  //     },
  //     editable: true,
  //     cellEditor: 'agSelectCellEditor',
  //     cellEditorParams: {
  //       values: ['Manager', 'User'],
  //     }
  //   },
  //   {
  //     field: 'contractName',
  //     headerName: 'Contract',
  //     valueGetter: (params: any) => {
  //       return this.getContractNameForUser(params.data.address) || 'No Contract Assigned';
  //     }
  //   }
  // ];
  
  // defaultColDef = {
  //   editable: false,
  //   resizable: true
  // };
  
  // onCellValueChanged(event: any) {
  //   if (event.colDef.field === 'role') {
  //     this.assignRole(event.data); 
  //   }
  // }


  constructor(private usersService: UsersService, private contractService: ContractService) { }

  ngOnInit(): void {
    this.loadData();
  }
  loadData(): void {
    this.isLoading = true;

    this.usersService.getAllUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.contractService.getAllContracts().subscribe({
          next: (contracts) => {
            this.contracts = contracts;
            this.contractDropdownOptions = [
              { id: -1, name: '-- Unassign Contract --' },
              ...contracts
                .filter(c => typeof c.id === 'number')
                .map(c => ({ id: c.id!, name: c.name || 'Unnamed Contract' }))
            ];
            this.isLoading = false;
          },
          error: (err) => {
            console.error('Error loading contracts', err);
            this.error = 'Failed to load contracts';
            this.isLoading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error loading users', err);
        this.error = 'Failed to load users';
        this.isLoading = false;
      }
    });
  }


  getContractNameForUser(address: string): string {
    const contract = this.contracts.find(c => c.owner.toLowerCase() === address.toLowerCase());
    return contract ? contract.name || 'Unnamed Contract' : 'NoContract';
  }
  startEditing(userId: number) {
    this.editingUserId = userId;
    const user = this.users.find(u => u.id === userId);
    const contract = this.contracts.find(c => c.owner.toLowerCase() === user.address.toLowerCase());

    if (contract) {
      this.selectedContractId = contract.id!;
      console.log(`✍️ Start editing: user ${user.username} has contract ${contract.name} (ID ${contract.id})`);
    } else {
      this.selectedContractId = -1; // nothing assigned
      console.log(`✍️ Start editing: user ${user.username} has no contract`);
    }
  }

  stopEditing() {
    this.editingUserId = null;
  }

  assignContract(user: any): void {
    console.log(`🧪 Start assignContract for user: ${user.username} (address: ${user.address})`);
    console.log(`🧪 Selected contract ID: ${this.selectedContractId}`);

    if (this.selectedContractId === -1) {
      console.log('🔍 Detected: Unassign request');
      const current = this.contracts.find(c =>
        c.owner.toLowerCase() === user.address.toLowerCase()
      );

      if (current && current.id !== undefined) {
        console.log(`🔄 Unassigning contract ID ${current.id} (${current.name})`);

        this.contractService.updateContract(current.id, {
          owner: '0x0000000000000000000000000000000000000000'
        }).subscribe({
          next: (res) => {
            console.log(` Contract ${current.name} successfully unassigned`, res);
            this.loadData();
            this.stopEditing();
          },
          error: (err) => {
            console.error(` Error unassigning contract ${current.name}`, err);
          }
        });
      } else {
        console.warn(` No contract currently assigned to ${user.username}`);
        this.stopEditing();
      }

      return;
    }

    if (!this.selectedContractId) {
      console.warn(' No contract selected to assign.');
      return;
    }

    console.log(`🔗 Assigning contract ID ${this.selectedContractId} to user ${user.username}`);

    this.contractService.updateContractOwner(this.selectedContractId, user.address).subscribe({
      next: (res) => {
        console.log(` Contract assigned to ${user.username}`, res);
        this.loadData();
        this.stopEditing();
      },
      error: (err) => {
        console.error(` Error assigning contract ID ${this.selectedContractId}`, err);
      }
    });
  }

  startEditingRole(userId: number): void {
    this.editingRoleUserId = userId;
    const user = this.users.find(u => u.id === userId);
    this.selectedRole = user?.role || null;
  }

  deleteUser(userId: number): void {
    console.log(`🗑️ Deleting user with ID: ${userId}`)
    this.usersService.deleteUser(userId).subscribe({
      next: (res) => {
        console.log(` User with ID ${userId} deleted successfully`, res);
        this.loadData();
      },
      error: (err) => {
        console.error(` Error deleting user with ID ${userId}`, err);
      }
    });
  }

  assignRole(user: any): void {
    if (!this.selectedRole) return;
    console.log(` Updating role of ${user.username} to ${this.selectedRole}`);

    this.usersService.updateUser(user.id, { role: this.selectedRole }).subscribe({
      next: (res) => {
        console.log(` Role updated for ${user.username}`, res);
        this.loadData();
        this.editingRoleUserId = null;
      },
      error: (err) => {
        console.error(` Error updating role for ${user.username}`, err);
      }
    });
  }

  
}  